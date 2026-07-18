# @quatrain/ingestion

Agnostic ingestion, extraction, and media processing interfaces for the Quatrain framework.

This package defines ports (`AbstractIngestionAdapter`) and common types to build OCR, audio transcription, video metadata parsing, and web crawling adapters.

## Architecture

Specific ingestion implementations inherit from `AbstractIngestionAdapter` and are registered to handle distinct media types.
* `@quatrain/ingestion-ocr`: Text extraction (Vision SDK, PDF parse).
* `@quatrain/ingestion-audio`: Audio transcripts (Whisper local/cloud).
* `@quatrain/ingestion-video`: Video downloads and track analysis (YouTube, MP4).
* `@quatrain/ingestion-web`: HTML parsing and normalization.

## License

AGPL-3.0-only
