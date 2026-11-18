# @quatrain/identifiers

Small, dependency-free helpers to generate and check identifiers: slugs, UUIDs, prefixed
identifiers and URIs.

## Installation

```bash
yarn add @quatrain/identifiers
```

## Features

| Function | Purpose |
|---|---|
| `slugify(text)` | Free text to slug: accents removed, lower case, hyphens |
| `isSlug` / `assertSlug` | 1–63 characters of `a-z`, `0-9`, inner hyphens — valid in a path, a file name, a DNS label |
| `uniqueSlug(base, isTaken)` | First free slug among `base`, `base-2`, `base-3`… |
| `uuid` / `isUuid` | Random UUID v4; check of any UUID |
| `prefixedId(prefix)` / `isPrefixedId` | Self-describing identifiers such as `doc_k2p…` (25 base-36 characters) |
| `isOpaqueId` / `assertOpaqueId` | Sanity check of identifiers issued elsewhere (bounded, no control characters) |
| `isUri(value, schemes?)` | Absolute URI, optionally restricted to allowed schemes |

Quatrain object references are handled by `ObjectUri` in `@quatrain/types`; this package does
not duplicate it.

## Uniqueness

These helpers shape identifiers; they cannot guarantee uniqueness. `uniqueSlug` checks then
returns, so two concurrent callers may get the same result. Uniqueness is enforced by the
storage: declare the property `unique` (see `@quatrain/backend`) and retry on conflict.

See [`HOWTO.md`](HOWTO.md) for examples.
