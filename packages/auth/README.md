# @quatrain/auth

The central authentication and identity abstraction for the Quatrain ecosystem. It provides a standard way to manage users, roles, and sessions across various Identity Providers (IdP).

## Introduction

Authentication often ties an application tightly to a specific vendor. By using `@quatrain/auth`, your application code interacts with a generic API for checking logins, retrieving user metadata, and enforcing permissions, while the actual implementation is delegated to adapters (Firebase Auth, Supabase Auth, etc.).

## Key Concepts

- **`Auth`**: The static registry where authentication adapters are configured.
- **`AbstractAuthAdapter`**: The base class for handling token verification, user fetching, and session management.

## Installation

```bash
npm install @quatrain/auth
# You will also need an adapter, e.g.:
npm install @quatrain/auth-firebase
```

## Architecture

At startup, register an adapter with `Auth.addAdapter()`. In your middleware or API routes, use `Auth.getAdapter().verifyToken(token)` to validate incoming requests and extract the normalized user profile.

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
