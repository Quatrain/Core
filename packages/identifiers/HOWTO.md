# How to use @quatrain/identifiers

## Slugs

```typescript
import { assertSlug, slugify, uniqueSlug } from '@quatrain/identifiers'

slugify('Maintenance Guide — Édition 2026') // 'maintenance-guide-edition-2026'
slugify('日本語') // '' — no Latin letter or digit: choose your own fallback

const base = slugify(title) || 'untitled'
const slug = await uniqueSlug(base, (candidate) => repository.existsBySlug(candidate))

assertSlug(request.params.slug, 'A document slug') // throws InvalidIdentifierError
```

## Identifiers

```typescript
import { isPrefixedId, isUuid, prefixedId, uuid } from '@quatrain/identifiers'

uuid() // '3f0c2a1e-…'
prefixedId('doc') // 'doc_0k2p9x…' — the prefix tells what the identifier points to
isPrefixedId(value, 'doc') // true only for a document identifier
isUuid(value)
```

Identifiers received from another system (an identity provider, a partner API) have no format
you control. Check only that they are safe to store and log:

```typescript
import { assertOpaqueId } from '@quatrain/identifiers'

assertOpaqueId(claims.sub, 'A user identifier')
```

## URIs

```typescript
import { isUri } from '@quatrain/identifiers'

isUri(link, ['https']) // rejects javascript:, file:, relative paths
isUri('okf:guides/maintenance', ['okf'])
```
