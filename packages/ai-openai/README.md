# @quatrain/ai-openai

Universal OpenAI-compatible AI adapter for the Quatrain framework.

Provides seamless, zero-dependency integration for:

-  **DeepSeek** (V3, R1) via `https://api.deepseek.com/v1`
-  **Alibaba Qwen** (2.5, Max, Plus) via DashScope or OpenRouter
-  **OpenAI** (GPT-4o, GPT-4o-mini, o1) via `https://api.openai.com/v1`
-  **Local sovereign models** (Ollama, vLLM, LocalAI)

## Installation

```bash
yarn add @quatrain/ai-openai
```

## Usage

```typescript
import { OpenAiAdapter } from '@quatrain/ai-openai'
import { Ai } from '@quatrain/ai'

// DeepSeek preset
const deepseek = OpenAiAdapter.forDeepSeek(process.env.DEEPSEEK_API_KEY!)
Ai.setAdapter(deepseek)

// Qwen preset
const qwen = OpenAiAdapter.forQwen(process.env.QWEN_API_KEY!)

// Custom endpoint (e.g. Ollama or vLLM)
const localModel = new OpenAiAdapter({
  apiKey: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  defaultModel: 'llama3.3:latest',
})

// Generate plain text
const answer = await deepseek.generateText(
  'Explain regenerative viticulture.',
)

// Generate structured data
const schema = {
  type: 'object',
  properties: { keywords: { type: 'array', items: { type: 'string' } } },
}
const data = await deepseek.generateStructured('Extract keywords', schema)

// Stream text chunks
const stream = await deepseek.generateTextStream('Tell a story.')
for await (const chunk of stream) {
  process.stdout.write(chunk)
}
```

## License

AGPL-3.0-only © Quatrain Développement SAS
