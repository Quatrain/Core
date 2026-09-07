# HOWTO: Using `@quatrain/searchengine-qmd`

This guide explains how to integrate and configure `@quatrain/searchengine-qmd` with `@quatrain/searchengine`.

## 1. Initializing and Registering the Adapter

```typescript
import { SearchEngine } from '@quatrain/searchengine';
import { QmdSearchEngineAdapter } from '@quatrain/searchengine-qmd';

const qmdAdapter = new QmdSearchEngineAdapter({
   alias: 'default',
   config: {
      collectionName: 'second-brain',
      storageDir: './content',
      preferCli: false
   }
});

await qmdAdapter.initialize();
SearchEngine.addEngine(qmdAdapter, 'default', true);
```

## 2. Indexing Markdown Documents

```typescript
await SearchEngine.indexDocument({
   id: 'okf-specification',
   title: 'OKF - The Markdown Spec for Humans and AI Agents',
   content: 'OKF is an open specification for creating AI-consumable knowledge bases using markdown files.',
   category: 'technology/ai',
   tags: ['spec', 'markdown', 'agents']
});
```

## 3. Querying the Search Engine

```typescript
const results = await SearchEngine.search('knowledge base', {
   mode: 'hybrid',
   category: 'technology',
   limit: 5
});

results.forEach(res => {
   console.log(`[Score: ${res.score}] ${res.title} - ${res.snippet}`);
});
```
