# @quatrain/ai

> 📦 **API Reference**: Detailed TypeScript documentation, classes, interfaces, and methods are available in the [TypeDoc API Reference for @quatrain/ai ↗](/api-reference/modules/_quatrain_ai.html).

AI adapters commons. Provides an abstraction layer for various Artificial Intelligence providers.

## Purpose

This package is part of the Quatrain Core monorepo. It provides functionality related to ai adapters commons. provides an abstraction layer for various artificial intelligence providers.

## HOWTO / Usage Examples

```typescript
import { Ai } from '@quatrain/ai'

// Register an adapter
Ai.registerAdapter(myAdapter)

// Use AI features
const response = await Ai.generate('Hello world')
```

## Conventions & Technical Details

- Follows the standard Quatrain architecture patterns.
- Ensure proper configuration before usage.
- See the root monorepo documentation for more details on building and testing this package.
