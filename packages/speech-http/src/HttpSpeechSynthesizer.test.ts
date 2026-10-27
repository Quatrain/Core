import { HttpSpeechSynthesizer, isAudioPayload, type AudioLike, type FetchLike } from './HttpSpeechSynthesizer'

/** Fake audio element, controlled by the test. */
interface FakeAudioInterface extends AudioLike {
   url: string
   paused: boolean
}

/**
 * Builds a fake audio factory.
 *
 * @param rejectPlay - Make `play()` reject (autoplay refused).
 * @returns The factory and the created elements.
 */
function fakeAudio(rejectPlay = false): { createAudio: (url: string) => AudioLike; elements: FakeAudioInterface[] } {
   const elements: FakeAudioInterface[] = []
   return {
      elements,
      createAudio: (url) => {
         const element: FakeAudioInterface = {
            url,
            paused: false,
            playbackRate: 1,
            onplaying: null,
            onended: null,
            onerror: null,
            play: () => (rejectPlay ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve()),
            pause: () => {
               element.paused = true
            },
         }
         elements.push(element)
         return element
      },
   }
}

/**
 * Builds a fake fetch answering a JSON payload.
 *
 * @param status - HTTP status.
 * @param body - JSON body.
 * @returns The fake and its recorded calls.
 */
function jsonFetch(status: number, body: unknown): { fetchImpl: FetchLike; calls: RequestInit[] } {
   const calls: RequestInit[] = []
   return {
      calls,
      fetchImpl: async (_url, init) => {
         calls.push(init)
         return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
      },
   }
}

/** Lets pending promise callbacks run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('isAudioPayload', () => {
   it('accepts a non-empty audioBase64 with an optional mimeType', () => {
      expect(isAudioPayload({ audioBase64: 'AAAA' })).toBe(true)
      expect(isAudioPayload({ audioBase64: 'AAAA', mimeType: 'audio/mpeg' })).toBe(true)
      expect(isAudioPayload({ audioBase64: '' })).toBe(false)
      expect(isAudioPayload({ audioBase64: 'AAAA', mimeType: 3 })).toBe(false)
      expect(isAudioPayload(null)).toBe(false)
   })
})

describe('HttpSpeechSynthesizer', () => {
   it('follows the network status', async () => {
      expect(await new HttpSpeechSynthesizer({ endpoint: '/speak', isOnline: () => false }).isAvailable()).toBe(false)
      expect(await new HttpSpeechSynthesizer({ endpoint: '/speak', isOnline: () => true }).isAvailable()).toBe(true)
   })

   it('requests the audio at prepare time and plays it with the rate', async () => {
      const { fetchImpl, calls } = jsonFetch(200, { audioBase64: 'AAAA' })
      const { createAudio, elements } = fakeAudio()
      const synthesizer = new HttpSpeechSynthesizer({ endpoint: '/speak', fetchImpl, createAudio })
      const utterance = synthesizer.prepare('Hello there.', { locale: 'en-US', voice: 'v1', style: 'warm', rate: 1.2 })
      expect(calls).toHaveLength(1)
      expect(calls[0].body).toBe(JSON.stringify({ text: 'Hello there.', locale: 'en-US', voice: 'v1', style: 'warm' }))

      let started = false
      const playing = utterance.play(() => {
         started = true
      })
      await flush()
      expect(elements[0].url).toBe('data:audio/wav;base64,AAAA')
      expect(elements[0].playbackRate).toBe(1.2)
      elements[0].onplaying?.(new Event('playing'))
      elements[0].onended?.(new Event('ended'))
      expect(await playing).toBe('completed')
      expect(started).toBe(true)
   })

   it('plays binary audio responses through an object URL', async () => {
      const released: string[] = []
      const { createAudio, elements } = fakeAudio()
      const synthesizer = new HttpSpeechSynthesizer({
         endpoint: '/speak',
         fetchImpl: async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }),
         createAudio,
         createObjectUrl: () => ({ url: 'blob:1', release: () => released.push('blob:1') }),
      })
      const playing = synthesizer.prepare('Hi.', { locale: 'en-US' }).play()
      await flush()
      elements[0].onended?.(new Event('ended'))
      expect(await playing).toBe('completed')
      expect(elements[0].url).toBe('blob:1')
      expect(released).toEqual(['blob:1'])
   })

   it('uses a custom body builder', async () => {
      const { fetchImpl, calls } = jsonFetch(200, { audioBase64: 'AAAA' })
      new HttpSpeechSynthesizer({ endpoint: '/speak', fetchImpl, buildBody: (text) => ({ input: text }) }).prepare('Hi.', { locale: 'en-US' })
      expect(calls[0].body).toBe(JSON.stringify({ input: 'Hi.' }))
   })

   it('fails on HTTP errors, bad payloads and refused playback', async () => {
      const options = { locale: 'en-US' }
      expect(await new HttpSpeechSynthesizer({ endpoint: '/speak', fetchImpl: jsonFetch(502, {}).fetchImpl }).prepare('Hi.', options).play()).toBe('failed')
      expect(await new HttpSpeechSynthesizer({ endpoint: '/speak', fetchImpl: jsonFetch(200, { nope: 1 }).fetchImpl }).prepare('Hi.', options).play()).toBe('failed')
      const refused = new HttpSpeechSynthesizer({ endpoint: '/speak', fetchImpl: jsonFetch(200, { audioBase64: 'AAAA' }).fetchImpl, createAudio: fakeAudio(true).createAudio })
      expect(await refused.prepare('Hi.', options).play()).toBe('failed')
   })

   it('aborts the download and stops playback on cancel', async () => {
      const signals: (AbortSignal | null | undefined)[] = []
      const { createAudio, elements } = fakeAudio()
      const synthesizer = new HttpSpeechSynthesizer({
         endpoint: '/speak',
         fetchImpl: async (_url, init) => {
            signals.push(init.signal)
            return new Response(JSON.stringify({ audioBase64: 'AAAA' }), { status: 200 })
         },
         createAudio,
      })
      const utterance = synthesizer.prepare('Hi.', { locale: 'en-US' })
      const playing = utterance.play()
      await flush()
      utterance.cancel()
      expect(await playing).toBe('interrupted')
      expect(signals[0]?.aborted).toBe(true)
      expect(elements[0].paused).toBe(true)
   })
})
