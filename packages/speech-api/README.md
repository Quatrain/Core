# @quatrain/speech-api

Remote speech adapter for [`@quatrain/speech`](../speech): plays the audio returned by any speech API endpoint, so the server can use the speech model of its choice.

- `prepare()` starts the request immediately: with `SpeechController`, the next sentence downloads while the current one plays.
- Endpoint contract: `POST` JSON (default body `{ text, locale, voice, style }`, customizable with `buildBody`), answering either audio bytes (`Content-Type: audio/*`) or JSON `{ audioBase64, mimeType? }`.
- `rate` is applied at playback; `cancel()` aborts the download and stops playback.

```typescript
import { ApiSpeechSynthesizer } from '@quatrain/speech-api'

const cloud = new ApiSpeechSynthesizer({ endpoint: '/api/speak', headers: { Authorization: `Bearer ${token}` } })
```
