# @quatrain/searchengine

Base search engine abstraction, contract interfaces, and singleton registry for the Quatrain Core framework.

## Overview

`@quatrain/searchengine` defines the standard `AbstractSearchEngineAdapter` interface and the central `SearchEngine` registry. It allows applications in the Quatrain ecosystem to perform hybrid document search, vector retrieval, and BM25 indexing without binding to specific search implementations.

## Features

- **Adapter Pattern**: Decouples search query execution from underlying search backends (QMD, Meilisearch, SQLite FTS, Algolia).
- **Singleton Registry**: Centralized engine registration with alias lookup via `SearchEngine.getEngine()`.
- **Fail-Fast Validation**: Guarantees initialization parameters are validated at constructor time.
- **TypeScript First**: Full type safety for documents, queries, and search result items.

## License

AGPL-v3
