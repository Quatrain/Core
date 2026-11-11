import { SpeechController } from './SpeechController'
import type { PreparedUtteranceInterface, SpeechEndReason, SpeechOptionsInterface, SpeechSynthesizerInterface } from './types'

const OPTIONS: SpeechOptionsInterface = { locale: 'en-US' }

/** Utterance whose playback is resolved manually by the test. */
interface ControlledUtteranceInterface extends PreparedUtteranceInterface {
   text: string
   cancelled: boolean
   finish(reason: SpeechEndReason): void
}

/**
 * Builds a fake synthesizer recording prepared utterances.
 *
 * @param id - Synthesizer id.
 * @param available - Availability.
 * @param autoReason - When set, every utterance ends immediately with this reason.
 * @returns The fake and its utterances.
 */
function fakeSynthesizer(
   id: string,
   available = true,
   autoReason?: SpeechEndReason,
): { synthesizer: SpeechSynthesizerInterface; utterances: ControlledUtteranceInterface[] } {
   const utterances: ControlledUtteranceInterface[] = []
   const synthesizer: SpeechSynthesizerInterface = {
      id,
      isAvailable: async () => available,
      prepare: (text) => {
         let resolvePlay: ((reason: SpeechEndReason) => void) | null = null
         const utterance: ControlledUtteranceInterface = {
            text,
            cancelled: false,
            play: (onStarted) =>
               new Promise<SpeechEndReason>((resolve) => {
                  if (autoReason) {
                     if (autoReason === 'completed') {
                        onStarted?.()
                     }
                     resolve(autoReason)
                     return
                  }
                  onStarted?.()
                  resolvePlay = resolve
               }),
            cancel: () => {
               utterance.cancelled = true
               resolvePlay?.('interrupted')
            },
            finish: (reason) => resolvePlay?.(reason),
         }
         utterances.push(utterance)
         return utterance
      },
   }
   return { synthesizer, utterances }
}

/** Lets pending promise callbacks run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

const TWO_SENTENCES = 'The first sentence is long enough. The second sentence is long enough too.'

describe('SpeechController', () => {
   it('prepares the next sentence while the current one plays', async () => {
      const { synthesizer, utterances } = fakeSynthesizer('local')
      const controller = new SpeechController([synthesizer])
      const started: string[] = []
      const done = controller.speak(TWO_SENTENCES, OPTIONS, { onStart: (id) => started.push(id) })
      await flush()

      expect(utterances.map((u) => u.text)).toEqual(['The first sentence is long enough.', 'The second sentence is long enough too.'])
      expect(started).toEqual(['local'])
      utterances[0].finish('completed')
      await flush()
      utterances[1].finish('completed')
      expect(await done).toBe('completed')
      expect(controller.speaking).toBe(false)
   })

   it('uses the first available synthesizer', async () => {
      const unavailable = fakeSynthesizer('cloud', false)
      const local = fakeSynthesizer('local', true, 'completed')
      const controller = new SpeechController([unavailable.synthesizer, local.synthesizer])
      expect(await controller.speak(TWO_SENTENCES, OPTIONS)).toBe('completed')
      expect(unavailable.utterances).toHaveLength(0)
      expect(local.utterances).toHaveLength(2)
   })

   it('falls back to the next synthesizer when the first sentence fails', async () => {
      const failing = fakeSynthesizer('cloud', true, 'failed')
      const local = fakeSynthesizer('local', true, 'completed')
      const controller = new SpeechController([failing.synthesizer, local.synthesizer])
      const started: string[] = []
      expect(await controller.speak(TWO_SENTENCES, OPTIONS, { onStart: (id) => started.push(id) })).toBe('completed')
      expect(started).toEqual(['local'])
      expect(failing.utterances[1].cancelled).toBe(true)
   })

   it('reports failed when no synthesizer is available', async () => {
      const controller = new SpeechController([fakeSynthesizer('cloud', false).synthesizer])
      const ends: SpeechEndReason[] = []
      expect(await controller.speak(TWO_SENTENCES, OPTIONS, { onEnd: (r) => ends.push(r) })).toBe('failed')
      expect(ends).toEqual(['failed'])
   })

   it('stops the current text and cancels the look-ahead', async () => {
      const { synthesizer, utterances } = fakeSynthesizer('local')
      const controller = new SpeechController([synthesizer])
      const done = controller.speak(TWO_SENTENCES, OPTIONS)
      await flush()
      controller.stop()
      expect(await done).toBe('interrupted')
      expect(utterances.every((u) => u.cancelled)).toBe(true)
   })

   it('interrupts the previous text when a new one is spoken', async () => {
      const { synthesizer, utterances } = fakeSynthesizer('local')
      const controller = new SpeechController([synthesizer])
      const first = controller.speak(TWO_SENTENCES, OPTIONS)
      await flush()
      const second = controller.speak('Another sentence that is long enough.', OPTIONS)
      expect(await first).toBe('interrupted')
      await flush()
      utterances[utterances.length - 1].finish('completed')
      expect(await second).toBe('completed')
   })

   it('completes immediately for blank text', async () => {
      const { synthesizer, utterances } = fakeSynthesizer('local')
      expect(await new SpeechController([synthesizer]).speak('  ', OPTIONS)).toBe('completed')
      expect(utterances).toHaveLength(0)
   })
})
