import type { PreparedUtteranceInterface, SpeechEndReason, SpeechOptionsInterface, SpeechSynthesizerInterface } from '@quatrain/speech'

/** Minimal `fetch` signature (injectable in tests). */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** Subset of `HTMLAudioElement` used by the adapter. */
export interface AudioLike {
   playbackRate: number
   onplaying: ((event: Event) => void) | null
   onended: ((event: Event) => void) | null
   onerror: ((event: Event | string) => void) | null
   play(): Promise<void>
   pause(): void
}

/** Audio returned by the endpoint, ready to be played. */
export interface AudioSourceInterface {
   /** `data:` or `blob:` URL. */
   url: string
   /** Releases the URL (blob URLs). */
   release(): void
}

/** Adapter settings. */
export interface ApiSpeechSynthesizerOptionsInterface {
   /** Endpoint synthesizing one text: `POST` JSON, answers audio bytes (`audio/*`) or `{ audioBase64, mimeType? }`. */
   endpoint: string
   /** Builds the JSON body (defaults to `{ text, locale, voice, style }`). */
   buildBody?: (text: string, options: SpeechOptionsInterface) => Record<string, unknown>
   /** Extra request headers. */
   headers?: Record<string, string>
   /** HTTP implementation (defaults to the global `fetch`). */
   fetchImpl?: FetchLike
   /** Audio element factory (defaults to `new Audio(url)`). */
   createAudio?: (url: string) => AudioLike
   /** Turns audio bytes into a playable URL (defaults to `URL.createObjectURL`). */
   createObjectUrl?: (blob: Blob) => AudioSourceInterface
   /** Network status (defaults to `navigator.onLine`, `true` outside browsers). */
   isOnline?: () => boolean
}

/**
 * Type guard for the JSON audio payload.
 *
 * @param value - Parsed JSON.
 * @returns `true` when the payload carries a non-empty `audioBase64` string.
 */
export function isAudioPayload(value: unknown): value is { audioBase64: string; mimeType?: string } {
   return (
      typeof value === 'object' &&
      value !== null &&
      'audioBase64' in value &&
      typeof value.audioBase64 === 'string' &&
      value.audioBase64.length > 0 &&
      (!('mimeType' in value) || value.mimeType === undefined || typeof value.mimeType === 'string')
   )
}

/**
 * Default conversion of audio bytes into a blob URL.
 *
 * @param blob - Audio bytes.
 * @returns The playable URL.
 */
function defaultObjectUrl(blob: Blob): AudioSourceInterface {
   const url = URL.createObjectURL(blob)
   return { url, release: () => URL.revokeObjectURL(url) }
}

/**
 * Cloud speech through any HTTP endpoint (the endpoint calls the speech model of its choice).
 * `prepare` starts the request immediately, so the next sentence downloads while the current one plays.
 */
export class ApiSpeechSynthesizer implements SpeechSynthesizerInterface {
   readonly id = 'api'

   /**
    * @param settings - Endpoint and injectable dependencies.
    */
   constructor(private readonly settings: ApiSpeechSynthesizerOptionsInterface) {}

   /**
    * @returns `true` when the device is online (the endpoint itself is only checked when speaking).
    */
   async isAvailable(): Promise<boolean> {
      if (this.settings.isOnline) {
         return this.settings.isOnline()
      }
      return typeof navigator === 'undefined' || navigator.onLine !== false
   }

   /**
    * Downloads the audio of one text.
    *
    * @param text - Text.
    * @param options - Speech options.
    * @param signal - Abort signal.
    * @returns The playable audio, or `null` when the endpoint produced none.
    */
   private async fetchAudio(text: string, options: SpeechOptionsInterface, signal: AbortSignal): Promise<AudioSourceInterface | null> {
      const fetchImpl = this.settings.fetchImpl ?? ((url: string, init: RequestInit) => fetch(url, init))
      const body = this.settings.buildBody
         ? this.settings.buildBody(text, options)
         : { text, locale: options.locale, voice: options.voice, style: options.style }
      const response = await fetchImpl(this.settings.endpoint, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', ...this.settings.headers },
         body: JSON.stringify(body),
         signal,
      })
      if (!response.ok) {
         return null
      }
      const contentType = response.headers.get('Content-Type') ?? ''
      if (contentType.startsWith('audio/')) {
         return (this.settings.createObjectUrl ?? defaultObjectUrl)(await response.blob())
      }
      const payload: unknown = await response.json()
      if (!isAudioPayload(payload)) {
         return null
      }
      return { url: `data:${payload.mimeType ?? 'audio/wav'};base64,${payload.audioBase64}`, release: () => undefined }
   }

   /**
    * @param text - Text to speak.
    * @param options - Speech options (`rate` is applied at playback).
    * @returns The prepared utterance; its audio starts downloading now.
    */
   prepare(text: string, options: SpeechOptionsInterface): PreparedUtteranceInterface {
      const controller = new AbortController()
      let cancelled = false
      let audio: AudioLike | null = null
      let finish: ((reason: SpeechEndReason) => void) | null = null
      const source = this.fetchAudio(text, options, controller.signal).catch(() => null)

      return {
         play: async (onStarted) => {
            const ready = await source
            if (cancelled) {
               ready?.release()
               return 'interrupted'
            }
            if (!ready) {
               return 'failed'
            }
            const createAudio = this.settings.createAudio ?? ((url: string): AudioLike => new Audio(url))
            const element = createAudio(ready.url)
            audio = element
            element.playbackRate = options.rate ?? 1
            return new Promise<SpeechEndReason>((resolve) => {
               finish = (reason) => {
                  finish = null
                  audio = null
                  ready.release()
                  resolve(reason)
               }
               element.onplaying = () => onStarted?.()
               element.onended = () => finish?.('completed')
               element.onerror = () => finish?.('failed')
               element.play().catch(() => finish?.(cancelled ? 'interrupted' : 'failed'))
            })
         },
         cancel: () => {
            cancelled = true
            controller.abort()
            audio?.pause()
            finish?.('interrupted')
         },
      }
   }
}
