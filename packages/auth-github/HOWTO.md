# HOWTO: Using `@quatrain/auth-github`

This guide explains how to configure and use the GitHub OAuth adapter and its associated endpoints.

---

## 1. Registering the Adapter

First, initialize the adapter using your GitHub OAuth application credentials, and register it to the global `Auth` manager:

```typescript
import { Auth } from '@quatrain/auth'
import { GithubAuthAdapter } from '@quatrain/auth-github'

const githubAdapter = GithubAuthAdapter.factory({
   clientId: process.env.GITHUB_CLIENT_ID,
   clientSecret: process.env.GITHUB_CLIENT_SECRET,
})

if (githubAdapter) {
   Auth.addProvider(githubAdapter, 'github')
}
```

---

## 2. Registering Pluggable Router Endpoints

To expose the login and callback routes, register them on your `ServerAdapter` using `Auth.registerEndpoints()`. This dynamically collects endpoints from all registered adapters and namespaces them.

### Web Server (Astro/Express) Example

```typescript
import { Auth } from '@quatrain/auth'
import { AstroAdapter } from '@quatrain/api-server-astro'

const server = new AstroAdapter()

// Register all endpoints under /api/auth/[provider_alias]
Auth.registerEndpoints(server, '/api/auth')
```

This will automatically mount:
- `GET /api/auth/github/login` -> Redirects the browser to GitHub login.
- `GET /api/auth/github/callback` -> Handles the OAuth code exchange.

---

## 3. Configuring Mobile Deep-Link Redirection

If the API is consumed by a mobile application, configure the `appScheme` option during server initialization:

```typescript
Auth.addProvider(githubAdapter, 'github')

// Inside your API setup, specify the target app scheme
server.addEndpoint(githubAdapter.getEndpointHandler(), '/api/auth/github', {
   appScheme: 'modaka' // Will redirect to modaka://auth/github/callback?token=...
})
```

Alternatively, you can pass the app scheme dynamically in the login/callback query string:
`GET /api/auth/github/callback?code=CODE&app_scheme=modaka`

---

## 4. Custom GitHub Repository Actions

The adapter includes helper functions to check and create repositories directly:

```typescript
// Check if a repository exists
const exists = await githubAdapter.checkRepositoryExists(accessToken, 'owner', 'repo-name')

// Create a new private repository
if (!exists) {
   const repo = await githubAdapter.createRepository(accessToken, 'repo-name', {
      private: true,
      description: 'Tactile knowledge base repository',
      autoInit: true
   })
}
```
