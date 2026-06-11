# @quatrain/code-github

GitHub API integration for Quatrain code management.

## Purpose

This package is part of the Quatrain Core monorepo. It implements the `@quatrain/code` interfaces specifically for GitHub, allowing seamless interaction with GitHub repositories, PRs, and issues.

## HOWTO / Usage Examples

```typescript
import { GithubAdapter } from '@quatrain/code-github'

const github = new GithubAdapter({ token: 'ghp_...' })
```

## Conventions & Technical Details

- Follows the standard Quatrain architecture patterns.
- Ensure proper configuration before usage.
- See the root monorepo documentation for more details on building and testing this package.
