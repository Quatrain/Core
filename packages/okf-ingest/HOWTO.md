# HOWTO: Using @quatrain/okf-ingest

> Comprehensive guide for ingesting documents, monographs, and technical papers into Open Knowledge Format (OKF v0.2) entities using pluggable AI adapters and composable domain profiles.

---

## 1. Overview & Architecture

`@quatrain/okf-ingest` provides an end-to-end pipeline to convert raw documents (PDFs, plain text, scanned files) into strictly structured OKF v0.2 Markdown files.

### Key Principles

1.  **Model Decoupled**: All LLM calls delegate strictly to `@quatrain/ai` via `AbstractAiAdapter` (such as `GeminiAdapter`).
2.  **Configurable Multilingual Targets**: Generates high-density abstracts and keywords in any list of target languages (`targetLanguages: ['en', 'fr', 'ar']`).
3.  **Composable Domain Profiles**: System personas, taxonomy fields (facets declared by the application, categories), and prompt guidelines are pluggable via `DomainTaxonomyProfile`.
4.  **Traceable Lineage & Accounting**: Tracks exact token counts, thinking tokens, USD costs, and parent document lineage (`sources`, `fileHash`, `generated`).

---

## 2. Setting Up the AI Adapter

`@quatrain/okf-ingest` requires an active `AbstractAiAdapter` from `@quatrain/ai`.

### Option A: Global Registration via `@quatrain/ai` (Recommended)

```typescript
import { Ai } from '@quatrain/ai';
import { GeminiAdapter } from '@quatrain/ai-gemini';

// Initialize and register globally once at application bootstrap
const adapter = new GeminiAdapter(process.env.GEMINI_API_KEY!);
adapter.init();
Ai.setAdapter(adapter);
```

### Option B: Passing an Explicit Adapter

```typescript
import { GeminiAdapter } from '@quatrain/ai-gemini';
import { extractSemanticContent } from '@quatrain/okf-ingest';

const adapter = new GeminiAdapter(process.env.GEMINI_API_KEY!);
adapter.init();

const result = await extractSemanticContent(input, undefined, { adapter });
```

---

## 3. Extracting a Single Document

To extract metadata, visual diagrams (Mermaid), and summaries from a document:

```typescript
import { extractSemanticContent, serializeOkfDocument } from '@quatrain/okf-ingest';
import * as fs from 'node:fs/promises';

const rawText = await fs.readFile('path/to/document.txt', 'utf-8');

const result = await extractSemanticContent(
   {
      filename: 'maintenance-guide.pdf',
      rawText,
      isScanned: false,
   },
   undefined, // apiKey resolved via adapter or process.env.GEMINI_API_KEY
   {
      targetLanguages: ['en', 'fr'], // Configurable target languages
      defaultCategory: 'technical-guides',
      soa: 'authority-namespace/knowledge-repo',
      revision: 'rev-2026.01',
   }
);

// Inspect token costs
console.log(`Tokens used: ${result.usage.total} ($${result.usage.costUsd} USD)`);

// Serialize to compliant OKF v0.2 Markdown
const markdown = serializeOkfDocument(result.metadata, result.body);
await fs.writeFile('output/maintenance-guide.md', markdown, 'utf-8');
```

---

## 4. Configuring Target Languages (`targetLanguages`)

Languages are fully parameterizable at both profile and runtime levels:

```typescript
// Generic document in English and Spanish
const result = await extractSemanticContent(input, undefined, {
   targetLanguages: ['en', 'es'],
});

console.log(result.metadata.abstracts);
// {
//   en: "English high-density technical summary...",
//   es: "Resumen técnico en español..."
// }

console.log(result.metadata.keywords);
// {
//   en: ["maintenance", "reliability", "inspection"],
//   es: ["mantenimiento", "fiabilidad", "inspección"]
// }
```

Built-in synthesis guidelines are automatically applied for `en`, `fr`, `ar`, `es`, `de`, `it`, `pt`, `ja`, and `zh`.

---

## 5. Using Domain Profiles (`DomainTaxonomyProfile`)

Domain profiles define domain-specific taxonomies, prompt guidelines, and JSON schemas.

### Using Built-in Profiles

```typescript
import { GenericDomainProfile } from '@quatrain/okf-ingest';

// Generic Profile (Defaults to ['en'])
const generic = new GenericDomainProfile();

const result = await extractSemanticContent(input, undefined, {
   taxonomyProfile: generic,
});
```

### Declaring the Facets of a Knowledge Base (`FacetTaxonomyProfile`)

The package knows no domain: an application declares its classification axes, and the
profile asks the model for them, requires them in the schema and keeps only the declared
keys. A facet with `values` has a closed vocabulary: any other value is dropped.

```typescript
import { FacetTaxonomyProfile } from '@quatrain/okf-ingest';

const profile = new FacetTaxonomyProfile({
   systemRole: 'You are an expert cataloguer of technical documentation.',
   targetLanguages: ['en', 'fr'],
   thematics: ['guides', 'reference', 'procedures'], // themes of the knowledge base
   facets: [
      { name: 'region', description: 'Regions the document applies to', examples: ['north', 'south'] },
      { name: 'audience', description: 'Who the document is for', values: ['beginner', 'expert'] },
   ],
});

const result = await extractSemanticContent(input, undefined, { taxonomyProfile: profile });
// result.metadata.region, result.metadata.audience, result.metadata.thematics
```

### Writing a Custom Domain Profile

For more than facets (own sections in the body, nested fields), implement
`DomainTaxonomyProfile`:

```typescript
import { DomainTaxonomyProfile } from '@quatrain/okf-ingest';

export class StandardsProfile implements DomainTaxonomyProfile {
   id = 'standards';
   name = 'Technical standards';
   systemRole = 'You are an expert in technical standards and compliance.';
   targetLanguages = ['en', 'fr'];
   defaultCategory = 'standards';

   promptGuidelines = [
      '"requirements": Normative requirements stated by the document.',
      '"references": Other standards the document cites.',
   ];

   schemaProperties = {
      requirements: { type: 'ARRAY', items: { type: 'STRING' } },
      references: { type: 'ARRAY', items: { type: 'STRING' } },
   };

   extractDomainMetadata(raw: Record<string, unknown>) {
      return {
         requirements: Array.isArray(raw.requirements) ? raw.requirements : undefined,
         references: Array.isArray(raw.references) ? raw.references : undefined,
      };
   }
}
```

---

## 6. Decomposing Large Monographs & Books (`ingestMonograph`)

For large multi-chapter books or encyclopedias:

```typescript
import { ingestMonograph, GenericDomainProfile } from '@quatrain/okf-ingest';
import * as fs from 'node:fs/promises';

const bookText = await fs.readFile('path/to/large-book.txt', 'utf-8');

const summary = await ingestMonograph(
   {
      rawText: bookText,
      filename: 'handbook-reference.pdf',
      fileHash: 'sha256-hash-here',
      originalFileUri: 'originals/books/handbook-reference.pdf',
      gitLocalPath: '/path/to/my-git-knowledge-repo',
   },
   {
      taxonomyProfile: new GenericDomainProfile(),
      targetLanguages: ['en', 'fr'],
      splitThresholdChars: 40000,
      defaultCategory: 'reference',
   }
);

console.log(`Decomposed into ${summary.chapterDocs.length} chapters.`);
console.log(`Master index: ${summary.masterRelativePath}`);
console.log(`Total cost: $${summary.totalCostUsd} USD`);
```

---

## 7. Deduplication & Token Accounting (`OkfDedupCache`)

Track ingested documents and avoid re-processing identical files:

```typescript
import { OkfDedupCache } from '@quatrain/okf-ingest';

const cache = new OkfDedupCache('/path/to/knowledge-repo/.okf-dedup.json');
await cache.init();

if (cache.isAlreadyIngested('sha256-hash-here')) {
   console.log('Document already processed, skipping.');
} else {
   // ... run extraction ...
   cache.registerEntry('sha256-hash-here', {
      filename: 'report.pdf',
      category: 'guides',
      tokens: result.usage,
   });
   await cache.save();
}
```
