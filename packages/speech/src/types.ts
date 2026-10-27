/**
 * Why an utterance stopped playing.
 * - `completed`: played to the end.
 * - `interrupted`: stopped by the application or the user before the end.
 * - `failed`: could not be synthesized or played.
 */
export type SpeechEndReason = 'completed' | 'interrupted' | 'failed'

/** How an utterance should be spoken. Adapters ignore the options they cannot honour. */
export interface SpeechOptionsInterface {
   /** BCP 47 locale, e.g. `fr-FR`, `en-US`. */
   locale: string
   /** Adapter-specific voice name (prebuilt cloud voice, device voice name). */
   voice?: string
   /** Free-text delivery style for adapters that support it (e.g. "warm, conversational"). */
   style?: string
   /** Speaking rate, 1 = normal. */
   rate?: number
   /** Voice pitch, 1 = normal. */
   pitch?: number
}

/** An utterance being prepared (fetched, synthesized) and ready to be played once. */
export interface PreparedUtteranceInterface {
   /**
    * Plays the utterance.
    *
    * @param onStarted - Called when audio actually starts.
    * @returns Why playback ended.
    */
   play(onStarted?: () => void): Promise<SpeechEndReason>
   /** Cancels preparation or playback; a pending or running `play` resolves with `interrupted`. */
   cancel(): void
}

/** A speech synthesis backend (on-device, native bridge, cloud endpoint...). */
export interface SpeechSynthesizerInterface {
   /** Stable identifier, e.g. `browser`, `http`. */
   readonly id: string
   /**
    * Tells whether this synthesizer can speak with these options right now (voice for the locale, network...).
    *
    * @param options - Speech options.
    * @returns `true` when usable.
    */
   isAvailable(options: SpeechOptionsInterface): Promise<boolean>
   /**
    * Starts preparing an utterance (adapters may start network work immediately, so the next sentence is ready
    * when the current one ends).
    *
    * @param text - Text to speak.
    * @param options - Speech options.
    * @returns The prepared utterance.
    */
   prepare(text: string, options: SpeechOptionsInterface): PreparedUtteranceInterface
}

/** Lifecycle callbacks of a spoken text. */
export interface SpeechEventsInterface {
   /** First audio of the text started; `synthesizerId` tells which backend is speaking. */
   onStart?: (synthesizerId: string) => void
   /** The whole text ended (or was interrupted, or failed). */
   onEnd?: (reason: SpeechEndReason) => void
}
