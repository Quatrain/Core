# @quatrain/ai-gemini

AI adapter for Google Gemini. Integrates the Gemini API into the Quatrain AI ecosystem.

## Purpose

This package is part of the Quatrain Core monorepo. It provides functionality related to ai adapter for google gemini. integrates the gemini api into the quatrain ai ecosystem.

## HOWTO / Usage Examples

```typescript
import { Ai } from '@quatrain/ai'
import { GeminiAdapter } from '@quatrain/ai-gemini'

Ai.registerAdapter(new GeminiAdapter({ apiKey: 'YOUR_API_KEY' }))

const response = await Ai.generate('Hello Gemini')
```

## Conventions & Technical Details

- Follows the standard Quatrain architecture patterns.
- Ensure proper configuration before usage.
- See the root monorepo documentation for more details on building and testing this package.
