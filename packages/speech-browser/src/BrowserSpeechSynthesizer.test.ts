import { BrowserSpeechSynthesizer, pickVoice, voiceMatchesLocale, type SpeechSynthesisLike, type UtteranceLike } from './BrowserSpeechSynthesizer'

/**
 * Builds a device voice.
 *
 * @param name - Voice name.
 * @param lang - Voice language.
 * @param localService - On-device voice.
 * @returns The voice.
 */
function voice(name: string, lang: string, localService = true): SpeechSynthesisVoice {
   return { name, lang, localService, default: false, voiceURI: name }
}

const VOICES = [voice('Remote EN', 'en-US', false), voice('Local EN', 'en-US'), voice('Local GB', 'en_GB'), voice('Local DE', 'de-DE')]

/**
 * Builds a fake engine recording spoken utterances.
 *
 * @param voices - Installed voices.
 * @returns The engine and the spoken utterances.
 */
function fakeEngine(voices: SpeechSynthesisVoice[] = VOICES): { engine: SpeechSynthesisLike; spoken: UtteranceLike[]; cancels: number[] } {
   const spoken: UtteranceLike[] = []
   const cancels: number[] = []
   const engine: SpeechSynthesisLike = {
      getVoices: () => voices,
      speak: (utterance) => {
         spoken.push(utterance)
      },
      cancel: () => {
         cancels.push(Date.now())
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
   }
   return { engine, spoken, cancels }
}

/** Lets pending promise callbacks run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('voiceMatchesLocale', () => {
   it('matches full locales and bare languages', () => {
      expect(voiceMatchesLocale(voice('a', 'en_GB'), 'en-GB')).toBe(true)
      expect(voiceMatchesLocale(voice('a', 'en-US'), 'en-GB')).toBe(false)
      expect(voiceMatchesLocale(voice('a', 'en-US'), 'en')).toBe(true)
   })
})

describe('pickVoice', () => {
   it('prefers the requested voice, then preferred voices, then on-device voices', () => {
      expect(pickVoice(VOICES, { locale: 'en-US', voice: 'Remote EN' })?.name).toBe('Remote EN')
      expect(pickVoice(VOICES, { locale: 'en-US' }, ['Remote EN'])?.name).toBe('Remote EN')
      expect(pickVoice(VOICES, { locale: 'en-US' })?.name).toBe('Local EN')
   })

   it('falls back to the language when the exact locale is missing', () => {
      expect(pickVoice(VOICES, { locale: 'de-AT' })?.name).toBe('Local DE')
      expect(pickVoice(VOICES, { locale: 'es-ES' })).toBeUndefined()
   })
})

describe('BrowserSpeechSynthesizer', () => {
   it('is available only when a voice speaks the locale', async () => {
      const { engine } = fakeEngine()
      const synthesizer = new BrowserSpeechSynthesizer({ synthesis: engine })
      expect(await synthesizer.isAvailable({ locale: 'en-US' })).toBe(true)
      expect(await synthesizer.isAvailable({ locale: 'es-ES' })).toBe(false)
   })

   it('waits for the voices list when it is not loaded yet', async () => {
      const { engine } = fakeEngine([])
      const synthesizer = new BrowserSpeechSynthesizer({ synthesis: engine, voicesTimeoutMs: 5 })
      expect(await synthesizer.isAvailable({ locale: 'en-US' })).toBe(false)
   })

   it('speaks with the chosen voice and options and reports start and completion', async () => {
      const { engine, spoken } = fakeEngine()
      const synthesizer = new BrowserSpeechSynthesizer({ synthesis: engine })
      let started = false
      const playing = synthesizer.prepare('Hello there.', { locale: 'en-US', rate: 1.1, pitch: 0.9 }).play(() => {
         started = true
      })
      await flush()

      expect(spoken).toHaveLength(1)
      expect(spoken[0]).toMatchObject({ text: 'Hello there.', lang: 'en-US', rate: 1.1, pitch: 0.9 })
      expect(spoken[0].voice?.name).toBe('Local EN')
      spoken[0].onstart?.()
      spoken[0].onend?.()
      expect(await playing).toBe('completed')
      expect(started).toBe(true)
   })

   it('maps engine errors to interrupted or failed', async () => {
      const { engine, spoken } = fakeEngine()
      const synthesizer = new BrowserSpeechSynthesizer({ synthesis: engine })
      const interrupted = synthesizer.prepare('One.', { locale: 'en-US' }).play()
      const failed = synthesizer.prepare('Two.', { locale: 'en-US' }).play()
      await flush()
      spoken[0].onerror?.('interrupted')
      spoken[1].onerror?.('synthesis-failed')
      expect(await interrupted).toBe('interrupted')
      expect(await failed).toBe('failed')
   })

   it('cancels a playing utterance', async () => {
      const { engine, cancels } = fakeEngine()
      const utterance = new BrowserSpeechSynthesizer({ synthesis: engine }).prepare('Hello.', { locale: 'en-US' })
      const playing = utterance.play()
      await flush()
      utterance.cancel()
      expect(await playing).toBe('interrupted')
      expect(cancels).toHaveLength(1)
   })

   it('does not speak an utterance cancelled before playback', async () => {
      const { engine, spoken } = fakeEngine()
      const utterance = new BrowserSpeechSynthesizer({ synthesis: engine }).prepare('Hello.', { locale: 'en-US' })
      utterance.cancel()
      expect(await utterance.play()).toBe('interrupted')
      expect(spoken).toHaveLength(0)
   })
})
