# @quatrain/cloudwrapper

A comprehensive wrapper for cloud provider SDKs within the Quatrain framework.

## Introduction

Instead of initializing multiple adapters (Auth, Backend, Storage) individually, `@quatrain/cloudwrapper` provides a unified entry point to initialize an entire ecosystem at once. For instance, if you are building exclusively on Firebase, the wrapper initializes Firestore, Firebase Auth, and Firebase Storage simultaneously using a single configuration object.

## Key Concepts

- **`CloudWrapper`**: The static registry where you define your wrapper.
- **`AbstractCloudWrapper`**: The base class that orchestrates the initialization of backend, auth, and storage adapters.

## Installation

```bash
npm install @quatrain/cloudwrapper
# You will also need an adapter, e.g.:
npm install @quatrain/cloudwrapper-firebase
```

## Architecture

The wrapper acts as a macro. When you configure and register it, it automatically creates and registers the underlying `@quatrain/backend`, `@quatrain/storage`, and `@quatrain/auth` adapters with the respective registries.

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
