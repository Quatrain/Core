---
type: pattern
title: Isomorphic API Client
description: Type-safe, fetch-based isomorphic HTTP client with AuthProvider integration via @quatrain/api-client.
tags:
  - quatrain
  - api-client
  - http
  - fetch
  - isomorphic
timestamp: 2026-09-17T00:00:00.000Z
category: api-and-gateways
status: active
---

# Isomorphic API Client

Quatrain uses `@quatrain/api-client` as its canonical HTTP communication library, replacing Axios. It is strictly isomorphic, executing identically across browser environments, Node.js SSR, React Native/Expo, and Bun.

---

## 🎯 Architectural Principles

1. **Native Fetch Foundation**: Built directly on top of native `fetch`, eliminating legacy request libraries.
2. **Pluggable AuthProvider**: Injects credentials and bearer tokens automatically prior to request dispatch via `client.setAuthProvider()`.
3. **Structured Response Envelope**: Standardizes all query results into `{ status, data, meta }`.

---

## ⚖️ Implementation Patterns

### ✅ Standard ApiClient Usage
```typescript
import { ApiClient } from "@quatrain/api-client";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

// Instantiate client with base URL
const client = new ApiClient("https://api.example.com/v1");

// Type-safe HTTP GET with pagination options
export async function fetchUsers(pageOffset: number = 0): Promise<UserProfile[]> {
  const response = await client.get("users", {
    batch: 25,
    offset: pageOffset,
  });

  console.log(`HTTP Status: ${response.status}`);
  return response.data as UserProfile[];
}

// Type-safe HTTP POST
export async function createUser(userData: { name: string; email: string }): Promise<UserProfile> {
  const response = await client.post("users", userData);
  return response.data as UserProfile;
}
```
