# HOWTO: Using @quatrain/okf-ingest-catalog

> Practical guide for decomposing structured encyclopedic catalogs, floras, pharmacopeias, dictionaries, and abécédaires into sequentially numbered OKF v0.2 atomic entities with full lineage tracking.

---

## 1. Overview & Catalog Architecture

Unlike free-form technical reports or monographs with narrative chapters, an **encyclopedic catalog** contains:
1. **Methodological / Foundational Chapters**: Introductory context (e.g. classification methodology, terminology, diagnostic keys).
2. **Sequential Entry Collection**: Dozens or hundreds of distinct atomic entries (e.g. botanical species, chemical compounds, technical terms).
3. **Lineage Contract**: Each atomic record maintains strict traceability back to its source publication (`parentBook: { title, slug, resource, fileHash }`) and its global sequence number (`sequence: 1, 2, ... N`).
4. **Master Index**: A root `index.md` listing introductory chapters and a structured markdown table referencing every atomic entry file.

---

## 2. Extraction Pipeline Workflow

```
PDF / Catalog Document
    │
    ├─► Extract Introductory Methodology Chapters (e.g. p. 1-20)
    │     └─► 01-taxonomy-and-methodology.md
    │
    ├─► Slicing / Detection of Catalog Chunks (e.g. p. 21-300)
    │     │
    │     ├─► Chunk 1: Salvia officinalis (p. 21)
    │     ├─► Chunk 2: Thymus vulgaris (p. 22)
    │     └─► ... Chunk N
    │
    ├─► Atomic AI Enrichment (@quatrain/ai adapter)
    │     ├─► Title, Canonical Scientific Name, Family
    │     ├─► Multilingual Abstracts & Keywords (targetLanguages)
    │     ├─► Diagnostic Indicators & Functional Properties
    │     └─► Diagrams & Markdown Tables
    │
    ├─► Write Ordered Atomic Fiches
    │     └─► entries/001-salvia-officinalis.md, entries/002-thymus-vulgaris.md
    │
    └─► Generate Master Monograph Index
          └─► index.md (Table of Contents + Catalog Table)
```

---

## 3. Detecting and Slicing Catalog Entries

Two complementary strategies are available to split raw catalog text into ordered chunks:

### Strategy A: Using Canonical Index Descriptors (`sliceCatalogEntriesByDescriptors`)

Ideal when a catalog has an authority index (e.g. alphabetical index at the end of the book):

```typescript
import { sliceCatalogEntriesByDescriptors } from '@quatrain/okf-ingest-catalog';

const descriptors = [
   {
      title: 'Common Sage',
      scientificName: 'Salvia officinalis',
      family: 'Lamiaceae',
      startMarker: 'SALVIA OFFICINALIS',
   },
   {
      title: 'Common Thyme',
      scientificName: 'Thymus vulgaris',
      family: 'Lamiaceae',
      startMarker: 'THYMUS VULGARIS',
   },
];

const chunks = sliceCatalogEntriesByDescriptors(rawCatalogText, descriptors);
// Returns CatalogEntryChunk[] with sequence: 1, 2, etc.
```

### Strategy B: Regex Header Detection (`detectCatalogEntriesRegex`)

Ideal for standardized structured publications with identifiable entry delimiters:

```typescript
import { detectCatalogEntriesRegex } from '@quatrain/okf-ingest-catalog';

// Example: matches "### ENTRY 42 : Subject Title"
const entryPattern = /^###\s*ENTRY\s*(\d+)\s*:\s*(.+)$/gm;

const chunks = detectCatalogEntriesRegex(rawCatalogText, entryPattern, {
   minLength: 100, // Skip short fragments
});
```

---

## 4. End-to-End Ingestion (`ingestCatalogMonograph`)

To execute the complete catalog ingestion with introductory chapters and atomic entries:

```typescript
import { Ai } from '@quatrain/ai';
import { GeminiAdapter } from '@quatrain/ai-gemini';
import { GenericDomainProfile } from '@quatrain/okf-ingest';
import { ingestCatalogMonograph } from '@quatrain/okf-ingest-catalog';

// 1. Setup Quatrain AI Adapter
const adapter = new GeminiAdapter(process.env.GEMINI_API_KEY!);
adapter.init();
Ai.setAdapter(adapter);

// 2. Execute Ingestion
const summary = await ingestCatalogMonograph(
   {
      bookTitle: "Encyclopedia of Botanical Flora",
      description: "Comprehensive field guide and reference catalog of botanical species and diagnostic keys.",
      category: "botany",
      authors: ["Flora Research Institute"],
      publisher: "Academic Press",
      publicationYear: 2024,
      edition: "First Edition",
      introChapters: [
         {
            index: 1,
            title: "Taxonomic Classification & Morphological Keys",
            slug: "01-taxonomy-and-methodology",
            text: ch1RawText,
         },
      ],
      entries: chunks, // CatalogEntryChunk[]
   },
   {
      gitLocalPath: "/path/to/my-knowledge-repo",
      originalFileUri: "originals/botanical-flora.pdf",
      fileHash: "sha256-hash-of-pdf",
      filename: "botanical-flora.pdf",
      taxonomyProfile: new GenericDomainProfile(), // or custom DomainTaxonomyProfile
      targetLanguages: ["en", "fr"], // Configurable multilingual target languages
      entryType: "catalog-entry",
      onProgress: (current, total, title) => {
         console.log(`Processing ${current}/${total}: ${title}`);
      },
   }
);

console.log(`Ingestion complete! Master index: ${summary.masterIndexPath}`);
console.log(`Created ${summary.totalEntries} atomic entries.`);
console.log(`Total tokens: ${summary.usage.total} ($${summary.usage.costUsd} USD)`);
```

---

## 5. Resulting Output Directory Structure

The engine generates a clean, browseable OKF v0.2 directory hierarchy:

```
content/botany/encyclopedia-of-botanical-flora/
├── index.md                        # Master monograph index with metadata & TOC
├── 01-taxonomy-and-methodology.md  # Chapter 1 (methodology)
└── entries/                        # Sequentially numbered atomic records
    ├── 001-salvia-officinalis.md   # Entry 1
    ├── 002-thymus-vulgaris.md      # Entry 2
    └── ...
```

---

## 6. Structure of an Atomic OKF v0.2 Catalog Record

Every entry generated adheres strictly to the OKF v0.2 lineage and taxonomy schema:

```yaml
---
# --- Open Knowledge Format v0.2 ---
type: catalog-entry
title: Common Sage (Salvia officinalis)
description: Salvia officinalis is a perennial subshrub belonging to the Lamiaceae family.
tags:
  - salvia
  - lamiaceae
  - medicinal-flora
status: draft
generated:
  by: quatrain/okf-ingest-catalog (gemini-2.5-flash)
  at: 2026-10-05T12:00:00.000Z
  tokens:
    prompt: 1145
    candidates: 755
    total: 3544
    costUsd: 0.000806
sources:
  - id: parent-book
    resource: originals/botanical-flora.pdf
    title: Encyclopedia of Botanical Flora
    fileHash: a1b2c3d4e5f6...
soa: authority-namespace/knowledge-repo
category: botany
language: en
originalLanguage: en
abstracts:
  en: Salvia officinalis is a woody perennial subshrub characterized by grayish aromatic leaves...
  fr: Salvia officinalis est un sous-arbrisseau vivace caractérisé par des feuilles grisâtres aromatiques...
keywords:
  en: [Salvia officinalis, Lamiaceae, perennial subshrub, aromatic]
  fr: [Salvia officinalis, Lamiacées, sous-arbrisseau vivace, aromatique]
sequence: 1
pageRange: "21"
scientificName: Salvia officinalis
family: Lamiaceae
diagnosticKeys:
  - well-drained calcareous substrate
properties:
  - antiseptic
  - antioxidant
parentBook:
  title: Encyclopedia of Botanical Flora
  slug: encyclopedia-of-botanical-flora
  resource: originals/botanical-flora.pdf
  fileHash: a1b2c3d4e5f6...
  authors: [Flora Research Institute]
  publisher: Academic Press
  publicationYear: "2024"
  edition: First Edition
---

# Common Sage (Salvia officinalis)

**Taxonomy / Classification:** *Salvia officinalis* | **Family / Group:** Lamiaceae

> Extracted from: [Encyclopedia of Botanical Flora](../index.md) (pages 21)

## 🔬 Key Diagnostic Criteria & Indicators
- **well-drained calcareous substrate**

## 🌿 Properties & Applications
- antiseptic
- antioxidant

## 📖 Detailed Entry Description & Source Text
[Source text of entry...]
```
