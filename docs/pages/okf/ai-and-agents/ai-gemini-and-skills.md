---
type: pattern
title: AI Gemini & Skills
description: Interfacing with Google Gemini models for text and structured JSON synthesis using GeminiAdapter from @quatrain/ai-gemini.
tags:
  - quatrain
  - ai
  - gemini
  - llm
  - json-schema
timestamp: 2026-09-17T00:00:00.000Z
category: ai-and-agents
status: active
---

# AI Gemini & Skills

Quatrain interfaces with Google's official Gemini AI models via `@quatrain/ai-gemini`. The adapter (`GeminiAdapter`) extends `AbstractAiAdapter` from `@quatrain/ai` and supports text synthesis, streaming, and schema-guaranteed JSON generation.

---

## 🎯 Architectural Principles

1. **Schema-Guaranteed Generation**: Use `generateStructured(prompt, schema, options)` when extracting domain objects or synthesizing structured fiches.
2. **Streaming for Interactive UI**: Use `generateTextStream(prompt, options)` for real-time token streaming to frontend clients.
3. **Fail-Fast Configuration**: Validate `GEMINI_API_KEY` before model instantiation.

---

## ⚖️ Implementation Patterns

### 1. Initializing GeminiAdapter
```typescript
import { GeminiAdapter } from "@quatrain/ai-gemini";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

export const aiAdapter = new GeminiAdapter(apiKey);
```

---

### 2. Schema-Constrained Extraction (`generateStructured`)
```typescript
import { aiAdapter } from "./ai";

interface SoilAnalysisResult {
  soilCategory: string;
  recommendedCoverCrop: string;
  waterRetentionScore: number;
}

// JSON Schema definition
const soilSchema = {
  type: "object",
  properties: {
    soilCategory: { type: "string" },
    recommendedCoverCrop: { type: "string" },
    waterRetentionScore: { type: "number" },
  },
  required: ["soilCategory", "recommendedCoverCrop", "waterRetentionScore"],
};

export async function extractSoilInsights(textReport: string): Promise<SoilAnalysisResult> {
  // Model guarantees response conforms to the provided schema
  const result = await aiAdapter.generateStructured(
    `Analyze the agronomy report and extract parameters:\n\n${textReport}`,
    soilSchema,
    { model: "gemini-2.5-flash" }
  );

  return result as SoilAnalysisResult;
}
```

---

### 3. Streaming Text Generation (`generateTextStream`)
```typescript
import { aiAdapter } from "./ai";

export async function streamSummary(prompt: string, onChunk: (text: string) => void): Promise<void> {
  const stream = await aiAdapter.generateTextStream(prompt, {
    model: "gemini-2.5-flash",
  });

  for await (const chunk of stream) {
    onChunk(chunk);
  }
}
```
