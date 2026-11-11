import { splitSentences } from './splitSentences'
import type {
   PreparedUtteranceInterface,
   SpeechEndReason,
   SpeechEventsInterface,
   SpeechOptionsInterface,
   SpeechSynthesizerInterface,
} from './types'

/** State of the text currently spoken. */
interface RunInterface {
   /** Utterances prepared and not finished yet (current and look-ahead). */
   pending: Set<PreparedUtteranceInterface>
   /** Set by `stop()`. */
   stopped: boolean
}

/**
 * Speaks texts with the first available synthesizer of a preference list, sentence by sentence: the next
 * sentence is prepared while the current one plays, so audio starts after the first sentence only.
 * When the preferred synthesizer fails on the first sentence, the next available one takes over.
 */
export class SpeechController {
   private run: RunInterface | null = null

   /**
    * @param synthesizers - Synthesizers by order of preference (e.g. on-device first, cloud as fallback).
    */
   constructor(private readonly synthesizers: SpeechSynthesizerInterface[]) {}

   /**
    * Speaks a text, interrupting the text currently spoken.
    *
    * @param text - Text to speak.
    * @param options - Speech options.
    * @param events - Lifecycle callbacks.
    * @returns Why playback ended.
    */
   async speak(text: string, options: SpeechOptionsInterface, events: SpeechEventsInterface = {}): Promise<SpeechEndReason> {
      this.stop()
      const run: RunInterface = { pending: new Set(), stopped: false }
      this.run = run
      const reason = await this.speakWith(run, splitSentences(text), options, events)
      if (this.run === run) {
         this.run = null
      }
      events.onEnd?.(reason)
      return reason
   }

   /** Stops the text currently spoken; its `speak` call resolves with `interrupted`. */
   stop(): void {
      const run = this.run
      if (!run) {
         return
      }
      run.stopped = true
      for (const utterance of run.pending) {
         utterance.cancel()
      }
      run.pending.clear()
      this.run = null
   }

   /** @returns Whether a text is being spoken. */
   get speaking(): boolean {
      return this.run !== null
   }

   /**
    * Returns the available synthesizers for these options, by order of preference.
    *
    * @param options - Speech options.
    * @returns Usable synthesizers.
    */
   private async availableSynthesizers(options: SpeechOptionsInterface): Promise<SpeechSynthesizerInterface[]> {
      const checks = await Promise.all(
         this.synthesizers.map(async (synthesizer) => {
            try {
               return (await synthesizer.isAvailable(options)) ? synthesizer : null
            } catch {
               return null
            }
         }),
      )
      return checks.filter((synthesizer): synthesizer is SpeechSynthesizerInterface => synthesizer !== null)
   }

   /**
    * Plays the sentences with the first synthesizer that manages to start, falling back on failure of the first sentence.
    *
    * @param run - Current run.
    * @param sentences - Sentences to speak.
    * @param options - Speech options.
    * @param events - Lifecycle callbacks.
    * @returns Why playback ended.
    */
   private async speakWith(
      run: RunInterface,
      sentences: string[],
      options: SpeechOptionsInterface,
      events: SpeechEventsInterface,
   ): Promise<SpeechEndReason> {
      if (sentences.length === 0) {
         return 'completed'
      }
      const candidates = await this.availableSynthesizers(options)
      if (run.stopped) {
         return 'interrupted'
      }
      for (const synthesizer of candidates) {
         const outcome = await this.playSentences(run, synthesizer, sentences, options, events)
         if (outcome.reason !== 'failed' || outcome.started) {
            return outcome.reason
         }
      }
      return 'failed'
   }

   /**
    * Plays all sentences with one synthesizer, preparing the next sentence during playback.
    *
    * @param run - Current run.
    * @param synthesizer - Synthesizer.
    * @param sentences - Sentences to speak.
    * @param options - Speech options.
    * @param events - Lifecycle callbacks.
    * @returns Why playback ended and whether any audio started.
    */
   private async playSentences(
      run: RunInterface,
      synthesizer: SpeechSynthesizerInterface,
      sentences: string[],
      options: SpeechOptionsInterface,
      events: SpeechEventsInterface,
   ): Promise<{ reason: SpeechEndReason; started: boolean }> {
      let started = false
      const prepare = (index: number): PreparedUtteranceInterface | null => {
         if (index >= sentences.length || run.stopped) {
            return null
         }
         const utterance = synthesizer.prepare(sentences[index], options)
         run.pending.add(utterance)
         return utterance
      }

      let current = prepare(0)
      for (let index = 0; current; index++) {
         const next = prepare(index + 1)
         const reason = await current.play(() => {
            if (!started) {
               started = true
               events.onStart?.(synthesizer.id)
            }
         })
         run.pending.delete(current)
         if (run.stopped) {
            next?.cancel()
            return { reason: 'interrupted', started }
         }
         if (reason !== 'completed') {
            if (next) {
               next.cancel()
               run.pending.delete(next)
            }
            return { reason, started }
         }
         current = next
      }
      return { reason: run.stopped ? 'interrupted' : 'completed', started }
   }
}
