# @quatrain/okf-ingest

Multi-source document ingestion, multimodal extraction, visual schema & Mermaid diagram transcription, token cost tracking, and Open Knowledge Format (OKF v0.2) packaging for the Quatrain ecosystem.

## Features

-  **OKF v0.2 Compliant:** Native support for the `# --- Open Knowledge Format v0.2 ---` specification, including `description` (1-sentence summary), `status`, `generated: { by, at, tokens }`, and `sources: [...]`.
-  **Text & Multimodal Ingestion:** Extracts digital text layers via `pdf-parse` and falls back automatically to multimodal Gemini vision for scanned or image-dense documents.
-  **Visual Synthesis & Mermaid Transcription:** Instructs Gemini to transcribe process flows, decision trees, and cycles into `mermaid` code blocks, and matrices/comparison charts into Markdown tables.
-  **Accurate Token & Cost Tracking:** Computes exact input/output/thinking token usage and USD costs per document.
-  **Resilient Dedup Cache:** SHA-256 hash tracking with persistent token accounting and automatic sync from existing Git knowledge repos.

## Installation

```bash
yarn add @quatrain/okf-ingest
# or
bun add @quatrain/okf-ingest
```

## License

AGPL-3.0-only
