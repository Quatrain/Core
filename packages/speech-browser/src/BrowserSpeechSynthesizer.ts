import type { PreparedUtteranceInterface, SpeechEndReason, SpeechOptionsInterface, SpeechSynthesizerInterface } from '@quatrain/speech'

/** Utterance description handed to the engine, with plain callbacks. */
export interface UtteranceLike {
   text: string
   lang: string
   voice: SpeechSynthesisVoice | null
   rate: number
   pitch: number
   onstart: (() => void) | null
   onend: (() => void) | null
   /** Called with the Web Speech error code (`interrupted`, `canceled`, `synthesis-failed`...). */
   onerror: ((error: string) => void) | null
}

/** Subset of the Web Speech `SpeechSynthesis` used by the adapter (injectable in tests). */
export interface SpeechSynthesisLike {
   getVoices(): SpeechSynthesisVoice[]
   speak(utterance: UtteranceLike): void
   cancel(): void
   addEventListener(type: 'voiceschanged', listener: () => void): void
   removeEventListener(type: 'voiceschanged', listener: () => void): void
}

/**
 * Wraps the Web Speech engine of the page into a {@link SpeechSynthesisLike}.
 *
 * @param synthesis - `window.speechSynthesis`.
 * @returns The engine, speaking `SpeechSynthesisUtterance` objects built from utterance descriptions.
 */
export function fromWebSpeech(synthesis: SpeechSynthesis): SpeechSynthesisLike {
   return {
      getVoices: () => synthesis.getVoices(),
      cancel: () => synthesis.cancel(),
      addEventListener: (type, listener) => synthesis.addEventListener(type, listener),
      removeEventListener: (type, listener) => synthesis.removeEventListener(type, listener),
      speak: (description) => {
         const utterance = new SpeechSynthesisUtterance(description.text)
         utterance.lang = description.lang
         utterance.voice = description.voice
         utterance.rate = description.rate
         utterance.pitch = description.pitch
         utterance.onstart = () => description.onstart?.()
         utterance.onend = () => description.onend?.()
         utterance.onerror = (event) => description.onerror?.(event.error)
         synthesis.speak(utterance)
      },
   }
}

/** Adapter settings. */
export interface BrowserSpeechSynthesizerOptionsInterface {
   /** Speech synthesis engine (defaults to the page engine through {@link fromWebSpeech}). */
   synthesis?: SpeechSynthesisLike
   /** Preferred device voice names, in order; the first one installed for the locale wins. */
   preferredVoices?: string[]
   /** How long to wait for the device voices list to load, in ms. */
   voicesTimeoutMs?: number
}

/** Default wait for the voices list (browsers load it asynchronously). */
const DEFAULT_VOICES_TIMEOUT_MS = 1500

/**
 * Tells whether a voice speaks a locale (`fr-FR` matches `fr-FR` and `fr_FR`; `fr` matches any French voice).
 *
 * @param voice - Device voice.
 * @param locale - BCP 47 locale.
 * @returns `true` when the voice language matches.
 */
export function voiceMatchesLocale(voice: SpeechSynthesisVoice, locale: string): boolean {
   const voiceLang = voice.lang.replace('_', '-').toLowerCase()
   const wanted = locale.replace('_', '-').toLowerCase()
   return wanted.includes('-') ? voiceLang === wanted : voiceLang.split('-')[0] === wanted
}

/**
 * Picks the device voice for the options: the requested voice, then preferred voices, then an exact locale
 * match (on-device first), then a language match.
 *
 * @param voices - Installed voices.
 * @param options - Speech options.
 * @param preferredVoices - Preferred voice names.
 * @returns The voice, or `undefined` when none speaks the locale.
 */
export function pickVoice(
   voices: SpeechSynthesisVoice[],
   options: SpeechOptionsInterface,
   preferredVoices: string[] = [],
): SpeechSynthesisVoice | undefined {
   const byLocale = voices.filter((voice) => voiceMatchesLocale(voice, options.locale))
   const byLanguage = byLocale.length > 0 ? byLocale : voices.filter((voice) => voiceMatchesLocale(voice, options.locale.split(/[-_]/)[0]))
   const names = options.voice ? [options.voice, ...preferredVoices] : preferredVoices
   for (const name of names) {
      const found = byLanguage.find((voice) => voice.name === name)
      if (found) {
         return found
      }
   }
   return byLanguage.find((voice) => voice.localService) ?? byLanguage[0]
}

/**
 * On-device speech synthesis through the Web Speech API: no network, audio starts almost immediately.
 * The `style` option is not supported by device voices and is ignored.
 */
export class BrowserSpeechSynthesizer implements SpeechSynthesizerInterface {
   readonly id = 'browser'
   private voicesLoad: Promise<SpeechSynthesisVoice[]> | null = null

   /**
    * @param settings - Engine and preferred voices.
    */
   constructor(private readonly settings: BrowserSpeechSynthesizerOptionsInterface = {}) {}

   /** @returns The speech synthesis engine, or `null` when the platform has none. */
   private get synthesis(): SpeechSynthesisLike | null {
      if (this.settings.synthesis) {
         return this.settings.synthesis
      }
      return typeof window !== 'undefined' && 'speechSynthesis' in window ? fromWebSpeech(window.speechSynthesis) : null
   }

   /**
    * Loads the device voices, waiting for `voiceschanged` when the list is still empty.
    *
    * @returns Installed voices (possibly empty).
    */
   private loadVoices(): Promise<SpeechSynthesisVoice[]> {
      const synthesis = this.synthesis
      if (!synthesis) {
         return Promise.resolve([])
      }
      const now = synthesis.getVoices()
      if (now.length > 0) {
         return Promise.resolve(now)
      }
      if (!this.voicesLoad) {
         this.voicesLoad = new Promise((resolve) => {
            const done = (): void => {
               synthesis.removeEventListener('voiceschanged', done)
               clearTimeout(timer)
               this.voicesLoad = null
               resolve(synthesis.getVoices())
            }
            const timer = setTimeout(done, this.settings.voicesTimeoutMs ?? DEFAULT_VOICES_TIMEOUT_MS)
            synthesis.addEventListener('voiceschanged', done)
         })
      }
      return this.voicesLoad
   }

   /**
    * @param options - Speech options.
    * @returns `true` when a device voice speaks the locale.
    */
   async isAvailable(options: SpeechOptionsInterface): Promise<boolean> {
      return pickVoice(await this.loadVoices(), options, this.settings.preferredVoices) !== undefined
   }

   /**
    * @param text - Text to speak.
    * @param options - Speech options.
    * @returns The prepared utterance (device synthesis needs no preparation).
    */
   prepare(text: string, options: SpeechOptionsInterface): PreparedUtteranceInterface {
      let cancelled = false
      let finish: ((reason: SpeechEndReason) => void) | null = null
      let speaking = false

      return {
         play: async (onStarted) => {
            const synthesis = this.synthesis
            if (cancelled) {
               return 'interrupted'
            }
            if (!synthesis) {
               return 'failed'
            }
            const voice = pickVoice(await this.loadVoices(), options, this.settings.preferredVoices)
            if (cancelled) {
               return 'interrupted'
            }
            const utterance: UtteranceLike = {
               text,
               lang: voice?.lang ?? options.locale,
               voice: voice ?? null,
               rate: options.rate ?? 1,
               pitch: options.pitch ?? 1,
               onstart: null,
               onend: null,
               onerror: null,
            }

            return new Promise<SpeechEndReason>((resolve) => {
               finish = (reason) => {
                  finish = null
                  speaking = false
                  resolve(reason)
               }
               utterance.onstart = () => {
                  onStarted?.()
               }
               utterance.onend = () => finish?.(cancelled ? 'interrupted' : 'completed')
               utterance.onerror = (error) => {
                  finish?.(cancelled || error === 'interrupted' || error === 'canceled' ? 'interrupted' : 'failed')
               }
               speaking = true
               synthesis.speak(utterance)
            })
         },
         cancel: () => {
            cancelled = true
            if (speaking) {
               this.synthesis?.cancel()
            }
            finish?.('interrupted')
         },
      }
   }
}
