# @quatrain/speech

Model-agnostic, local-first speech synthesis for Quatrain applications.

## Purpose

- One contract (`SpeechSynthesizerInterface`) for every speech backend: on-device voices, native bridges, cloud models behind an HTTP endpoint.
- `SpeechController` speaks a text with the first available synthesizer of a preference list, **sentence by sentence**: the next sentence is prepared while the current one plays, so audio starts after the first sentence only.
- Automatic fallback when the preferred synthesizer fails before any audio, `stop()` / interruption, normalized events (`onStart`, `onEnd` with `completed | interrupted | failed`) for latency and engagement metrics.
- Options: `locale`, `voice`, `style`, `rate`, `pitch` (adapters ignore what they cannot honour).

## Adapters

| Package | Runs in | Backend |
|---|---|---|
| `@quatrain/speech-browser` | browser | Web Speech API (on-device, no network) |
| `@quatrain/speech-api` | browser | any endpoint returning audio (cloud models) |

## HOWTO

```typescript
import { SpeechController } from '@quatrain/speech'
import { BrowserSpeechSynthesizer } from '@quatrain/speech-browser'
import { ApiSpeechSynthesizer } from '@quatrain/speech-api'

const local = new BrowserSpeechSynthesizer()
const cloud = new ApiSpeechSynthesizer({ endpoint: '/api/speak' })

// "fast" mode: device voice first, cloud as fallback
const speech = new SpeechController([local, cloud])

await speech.speak('Your report is ready. It covers the last seven days.', { locale: 'en-US', rate: 1 }, {
   onStart: (synthesizerId) => console.log('audio started with', synthesizerId),
   onEnd: (reason) => console.log('ended:', reason),
})

speech.stop() // interrupt
```
