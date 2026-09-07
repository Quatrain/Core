# @quatrain/searchengine-qmd

QMD (Query Markup Documents) search engine provider adapter for the `@quatrain/searchengine` namespace.

## Overview

`@quatrain/searchengine-qmd` connects the Quatrain Core framework with QMD, a local-first search engine that combines BM25 keyword matching, vector embeddings, and LLM re-ranking across Markdown and OKF document repositories.

## Features

- **Hybrid Search**: BM25, semantic vector retrieval, and scoring.
- **Category & Tag Scoping**: Filters search queries by folder taxonomy.
- **Dual Execution Engine**: Automatic detection and execution via QMD CLI binary or structured local fallback.
- **Fail-Fast Configuration**: Validates storage paths and collection parameters at startup.

## License

AGPL-v3
