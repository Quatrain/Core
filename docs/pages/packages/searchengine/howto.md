# HOWTO: Using `@quatrain/searchengine`

This guide presents the most common usage scenarios for configuring and performing document searches with `@quatrain/searchengine`.

## 1. Defining a Custom Search Engine Adapter

Extend `AbstractSearchEngineAdapter` and implement the abstract methods:

```typescript
import { AbstractSearchEngineAdapter, SearchDocument, SearchQueryOptions, SearchResultItem } from '@quatrain/searchengine';

export class CustomSearchAdapter extends AbstractSearchEngineAdapter {
   async initialize(): Promise<void> {
      // Connect to search backend or initialize index
   }

   async indexDocument(doc: SearchDocument): Promise<void> {
      // Index document
   }

   async removeDocument(id: string): Promise<void> {
      // Remove document
   }

   async search(query: string, options?: SearchQueryOptions): Promise<SearchResultItem[]> {
      // Execute search query
      return [];
   }
}
```

## 2. Registering an Engine Instance

Register the adapter into the `SearchEngine` singleton:

```typescript
import { SearchEngine } from '@quatrain/searchengine';
import { CustomSearchAdapter } from './CustomSearchAdapter';

const adapter = new CustomSearchAdapter({
   alias: 'default',
   config: { host: 'localhost' }
});

SearchEngine.addEngine(adapter, 'default', true);
```

## 3. Indexing and Searching Documents

```typescript
// Indexing
await SearchEngine.indexDocument({
   id: 'doc-101',
   title: 'Project Architecture Plan',
   content: 'Cloud-native architecture and dependency injection guidelines.',
   category: 'technology'
});

// Searching
const results = await SearchEngine.search('cloud-native', {
   mode: 'hybrid',
   limit: 10
});

console.log(results);
```
