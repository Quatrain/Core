# @quatrain/okf

Open Knowledge Format (OKF) flat file storage adapter for the Quatrain Core framework.

## Overview

The `@quatrain/okf` package provides a file-based persistence adapter (`OKFBackendAdapter`) that serializes Quatrain `PersistedBaseObject` entities into a structured flat file filesystem directory conforming to the OKF format.

This adapter is specifically designed to facilitate local-first, offline-first architectures by excluding relational databases and utilizing structured directory trees containing lightweight JSON files.

## Features

- **Decoupled Architecture:** Pure filesystem storage format independent of underlying Git versioning or synchronization layers.
- **Operator Auditing:** Automatically stores the operator's email in the document's metadata block (`meta.created_by`) for full change traceability.
- **Hierarchical Layouts:**
  - Telemetry: Saved as `telemetry/YYYY-MM-DD/{type}/{HHMMSS}-{millis}-{bassinId}.json`
  - Other: Saved as `{collection}/{uid}.json`

## OKF v0.2 documents

Besides the backend adapter, the package reads and writes concept documents of the
[Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md):
YAML frontmatter and markdown body, provenance and trust, index files. It does not depend
on the adapter.

```typescript
import {
   parseOkfDocument,
   serializeOkfDocument,
   validateOkfDocument,
   withOkfGenerated,
   withOkfVerification,
   okfTrustTier,
} from '@quatrain/okf'

const document = parseOkfDocument(text) // unknown keys kept; bare `verified` read as a list
document.frontmatter = withOkfGenerated(document.frontmatter, 'process:ingest')
document.frontmatter = withOkfVerification(document.frontmatter, 'human:ada')
okfTrustTier(document.frontmatter) // 'human-reviewed'

const issues = validateOkfDocument(document, {
   required: ['title', 'generated'],
   forbidEmpty: true,
   forbidLegacy: true,
   rules: [({ frontmatter }) => (frontmatter.licence ? [] : [{ severity: 'error', key: 'licence', message: 'is required' }])],
})
const text2 = serializeOkfDocument(document)
```

| Function | Does |
|---|---|
| `parseOkfDocument(text)` | Frontmatter and body. Throws `OkfFormatError` without frontmatter, on invalid YAML, or when it is not a mapping |
| `serializeOkfDocument(document)` | Keys of the specification first, extensions after in their order; `undefined` and `null` left out; body written as given |
| `isOkfConceptFile(name)` | A `.md` file whose name is not reserved (`index.md`, `log.md`) |
| `parseOkfActor(actor)` | `human:<id>`, `process:<id>` or `<producer>/<version>`, else `undefined` |
| `okfTrustTier(frontmatter)` | `unverified`, `machine-confirmed` or `human-reviewed`, from `verified` |
| `isOkfStale(frontmatter, now?)` | `now` at or after `stale_after` |
| `okfLastChange(frontmatter)` | `generated.at`, or a legacy `timestamp` |
| `withOkfGenerated(frontmatter, by, at?)` | Sets `generated`, removes a legacy `timestamp` |
| `withOkfVerification(frontmatter, by, at?)` | Adds a verification; one entry per actor |
| `validateOkfDocument(document, profile?)` | Errors and warnings for the producer-side rules of the specification, plus those of an application profile (required keys, no empty values, no v0.1 keys, own rules) |
| `upgradeOkfDocument(document, { by })` | v0.1 to v0.2: `timestamp` becomes `generated`; reports a body `# Citations` list |
| `renderOkfIndex(sections, options?)` | An `index.md`: `* [Title](href) - description` lines under headings; `okf_version` frontmatter at the bundle root only |

A consumer should not reject a document for the issues of the specification alone (§11 of
the specification); a producer should not write one with errors. Attested computations (§10)
are not covered.
