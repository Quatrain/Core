# @quatrain/storage

The unified file and blob storage abstraction for the Quatrain ecosystem. This package provides a consistent API for uploading, downloading, and managing files across different storage providers (S3, Firebase, Supabase).

## Introduction

Modern applications often need to switch between local storage (for development) and cloud storage (for production), or migrate from one provider to another. `@quatrain/storage` ensures that your application code remains identical regardless of the underlying storage mechanism.

## Key Concepts

- **`Storage`**: The central registry where you configure and retrieve storage adapters.
- **`AbstractStorageAdapter`**: The base class defining the contract for all storage adapters (e.g., `put`, `get`, `delete`, `getUrl`).

## Installation

```bash
npm install @quatrain/storage
# You will also need an adapter, e.g.:
npm install @quatrain/storage-s3
```

## Architecture

Storage operations rely on buckets. Once an adapter is registered to an alias, you can request that adapter and perform file operations using a bucket name and a file path.

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
