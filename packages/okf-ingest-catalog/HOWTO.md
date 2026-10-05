# HOWTO: Using @quatrain/okf-ingest-catalog

> Practical guide for decomposing structured encyclopedic catalogs, floras, pharmacopeias, dictionaries, and abécédaires into sequentially numbered OKF v0.2 atomic entities with full lineage tracking.

---

## 1. Overview & Catalog Architecture

Unlike free-form technical reports or monographs with narrative chapters, an **encyclopedic catalog** contains:
1. **Methodological / Foundational Chapters**: Introductory context (e.g. soil science basics, plant classification criteria).
2. **Sequential Entry Collection**: Dozens or hundreds of distinct atomic entries (e.g. plant fiches, chemical entries, medical preparations).
3. **Lineage Contract**: Each atomic record must maintain strict traceability back to its source publication (`parentBook: { title, slug, resource, fileHash }`) and its global sequence number (`sequence: 1, 2, ... N`).
4. **Master Index**: A root `index.md` listing introductory chapters and a structured markdown table referencing every atomic entry file.

---

## 2. Extraction Pipeline Workflow

```
PDF / Document
    │
    ├─► Extract Introductory Methodology Chapters (p. 8-47)
    │     └─► 01-bases-du-sol.md, 02-cah-et-blocages.md
    │
    ├─► Slicing / Detection of Catalog Chunks (p. 50-339)
    │     │
    │     ├─► Chunk 1: Acanthus mollis (p. 50)
    │     ├─► Chunk 2: Acer platanoides (p. 51)
    │     └─► ... Chunk N
    │
    ├─► Atomic AI Enrichment (@quatrain/ai adapter)
    │     ├─► Title, Canonical Scientific Name, Family
    │     ├─► Multilingual Abstracts & Keywords (targetLanguages)
    │     ├─► Diagnostic Indicators & Functional Properties
    │     └─► Diagrams & Markdown Tables
    │
    ├─► Write Ordered Atomic Fiches
    │     └─► entries/001-acanthus-mollis.md, entries/002-acer-platanoides.md
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
      title: 'Acanthe molle',
      scientificName: 'Acanthus mollis',
      family: 'Acanthaceae',
      startMarker: 'ACANTHACÉES',
   },
   {
      title: 'Érable plane',
      scientificName: 'Acer platanoides',
      family: 'Sapindaceae',
      startMarker: 'ACÉRACÉES',
   },
];

const chunks = sliceCatalogEntriesByDescriptors(rawCatalogText, descriptors);
// Returns CatalogEntryChunk[] with sequence: 1, 2, etc.
```

### Strategy B: Regex Header Detection (`detectCatalogEntriesRegex`)

Ideal for standardized structured publications with identifiable entry delimiters:

```typescript
import { detectCatalogEntriesRegex } from '@quatrain/okf-ingest-catalog';

// Example: matches "### FICHE 42 : Plant Name"
const entryPattern = /^###\s*FICHE\s*(\d+)\s*:\s*(.+)$/gm;

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
import { BradAgronomyProfile } from '@quatrain/okf-ingest';
import { ingestCatalogMonograph } from '@quatrain/okf-ingest-catalog';

// 1. Setup Quatrain AI Adapter
const adapter = new GeminiAdapter(process.env.GEMINI_API_KEY!);
adapter.init();
Ai.setAdapter(adapter);

// 2. Execute Ingestion
const summary = await ingestCatalogMonograph(
   {
      bookTitle: "L'encyclopédie des plantes bio-indicatrices - Volume 3",
      description: "Guide complet de diagnostic des sols par les plantes bio-indicatrices par Gérard Ducerf.",
      category: "bio-indication",
      authors: ["Gérard Ducerf"],
      publisher: "Éditions Promonature",
      publicationYear: 2008,
      edition: "Volume 3",
      introChapters: [
         {
            index: 1,
            title: "Comprendre les bases du sol et le CAH",
            slug: "01-bases-du-sol",
            text: ch1RawText,
         },
      ],
      entries: chunks, // CatalogEntryChunk[]
   },
   {
      gitLocalPath: "/path/to/my-knowledge-repo",
      originalFileUri: "originals/ducerf-vol-3.pdf",
      fileHash: "sha256-hash-of-pdf",
      filename: "ducerf-vol-3.pdf",
      taxonomyProfile: new BradAgronomyProfile(), // or GenericDomainProfile()
      targetLanguages: ["fr", "en", "ar"], // Multilingual target languages
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
content/bio-indication/lencyclopedie-des-plantes-bio-indicatrices-volume-3/
├── index.md                     # Master monograph index with metadata & TOC
├── 01-bases-du-sol.md           # Chapter 1 (methodology)
└── entries/                     # Sequentially numbered atomic records
    ├── 001-acanthus-mollis.md   # Entry 1 (Acanthe molle)
    ├── 002-acer-platanoides.md  # Entry 2 (Érable plane)
    └── 003-acer-pseudoplatanus.md
```

---

## 6. Structure of an Atomic OKF v0.2 Catalog Record

Every entry generated adheres strictly to the OKF v0.2 lineage and taxonomy schema:

```yaml
---
# --- Open Knowledge Format v0.2 ---
type: catalog-entry
title: Acanthus (Acanthus mollis)
description: Acanthus mollis is a robust perennial herb belonging to the Acanthaceae family.
tags:
  - acanthus
  - acanthaceae
  - bio-indication
status: draft
generated:
  by: quatrain/okf-ingest-catalog (gemini-2.5-flash)
  at: 2026-10-05T12:46:44.375Z
  tokens:
    prompt: 1145
    candidates: 755
    total: 3544
    costUsd: 0.000806
sources:
  - id: parent-book
    resource: originals/ducerf-vol-3.pdf
    title: L'encyclopédie des plantes bio-indicatrices - Volume 3
    fileHash: ea231c95a0c5107cd90b53fca5772806e1902db22d217996ffdaeb251822fcf5
soa: quatrain/knowledge
category: bio-indication
language: fr
originalLanguage: fr
abstracts:
  fr: Plante vivace pubescente de 30-80 cm, bio-indicatrice d'un engorgement en matière organique...
  en: Acanthus mollis is a pubescent perennial plant, serving as a bioindicator for organic matter...
  ar: تتميز نبتة الأقنثا المعمرة والمغطاة بالزغب بكونها مؤشراً حيوياً على تشبع التربة بالمواد العضوية...
keywords:
  fr: [Acanthus mollis, Acanthacées, bio-indicatrice, sol humide]
  en: [Acanthus mollis, Acanthaceae, bioindicator, wet soil]
  ar: [أقنثا موليس, أقنثية, مؤشر حيوي, تربة رطبة]
sequence: 1
pageRange: "50"
scientificName: Acanthus mollis
family: Acanthaceae
diagnosticKeys:
  - engorgement en matière organique carbonée sur sol humide
properties:
  - anti-inflammatoire
parentBook:
  title: L'encyclopédie des plantes bio-indicatrices - Volume 3
  slug: lencyclopedie-des-plantes-bio-indicatrices-volume-3
  resource: originals/ducerf-vol-3.pdf
  fileHash: ea231c95a0c5107cd90b53fca5772806e1902db22d217996ffdaeb251822fcf5
  authors: [Gérard Ducerf]
  publisher: Éditions Promonature
  publicationYear: "2008"
  edition: Volume 3
soils:
  - humide
  - engorgement-matiere-organique-carbonee
climates:
  - méditerranéen
---

# Acanthus (Acanthus mollis)

**Taxonomy / Classification:** *Acanthus mollis* | **Family / Group:** Acanthaceae

> Extracted from: [L'encyclopédie des plantes bio-indicatrices - Volume 3](../index.md) (pages 50)

## 🔬 Key Diagnostic Criteria & Indicators
- **engorgement en matière organique carbonée sur sol humide**

## 🌱 Soil & Habitat Characteristics
- humide
- engorgement-matiere-organique-carbonee

## 🌿 Properties & Applications
- anti-inflammatoire

## 📖 Detailed Entry Description & Source Text
[Source text of entry...]
```
