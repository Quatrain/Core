# @quatrain/auth-oidc

> 📦 **API Reference**: Detailed TypeScript documentation, classes, interfaces, and methods are available in the [TypeDoc API Reference for @quatrain/auth-oidc ↗](/api-reference/modules/_quatrain_auth-oidc.html).

OIDC Authentication provider for Quatrain.

## Purpose

This package is part of the Quatrain Core monorepo. It provides an OpenID Connect (OIDC) authentication adapter, allowing integration with standard OIDC identity providers.

## HOWTO / Usage Examples

```typescript
import { AuthOIDC } from '@quatrain/auth-oidc'

const oidc = AuthOIDC.init('https://issuer.example.com', { /* config */ })
```

## Conventions & Technical Details

- Follows the standard Quatrain architecture patterns.
- Ensure proper configuration before usage.
- See the root monorepo documentation for more details on building and testing this package.
