# @quatrain/speech-browser

On-device speech synthesis adapter for [`@quatrain/speech`](../speech), based on the Web Speech API (`speechSynthesis`).

- No network round trip: audio starts almost immediately.
- Voice selection: requested `voice`, then `preferredVoices`, then an on-device voice of the exact locale, then any voice of the language.
- `isAvailable()` is `false` when no installed voice speaks the locale, so a controller can fall back to a cloud synthesizer.
- The `style` option is not supported by device voices and is ignored.

```typescript
import { BrowserSpeechSynthesizer } from '@quatrain/speech-browser'

const local = new BrowserSpeechSynthesizer({ preferredVoices: ['Samantha', 'Google US English'] })
```
