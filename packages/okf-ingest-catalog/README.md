# @quatrain/okf-ingest-catalog

Agnostic ingestion and decomposition engine for encyclopedic catalogs, plant floras, dictionaries, pharmacopeias, and ordered entry collections into Open Knowledge Format (OKF v0.2) atomic entities.

## Features

- **Agnostic Catalog Slicing**: Splits massive encyclopedic catalogs by canonical index descriptors (`sliceCatalogEntriesByDescriptors`) or structured regex patterns (`detectCatalogEntriesRegex`).
- **Sequential Ordering & Traceability**: Automatically numbers records sequentially (`sequence: 1, 2, ... N`), preserves original page ranges (`pageRange`), and captures canonical Latin/scientific binomials (`scientificName`) and families (`family`).
- **Lineage Contract**: Injects parent book provenance (`parentBook: { title, slug, resource, fileHash }`) into every child record.
- **Model Decoupled**: Delegates all structured AI generation via `@quatrain/ai` adapters (`AbstractAiAdapter`).
- **Configurable Multilingual Targets**: Generates high-density abstracts and keywords in requested languages (`targetLanguages: ['en', 'fr', 'ar']`).
- **Master Monograph Index Generation**: Automatically creates a root `index.md` featuring methodological chapters and a Markdown table referencing every entry.

## Installation

```bash
yarn add @quatrain/okf-ingest-catalog @quatrain/okf-ingest @quatrain/ai
# or
bun add @quatrain/okf-ingest-catalog @quatrain/okf-ingest @quatrain/ai
```

## Documentation

See the comprehensive [HOWTO Guide](./HOWTO.md) for step-by-step instructions and code examples.

## License

AGPL-3.0-only
