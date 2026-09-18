# How To: Using @quatrain/auth-supabase

This guide explains how to instantiate the Supabase authentication adapter, register it into the global `Auth` registry, and perform authentication operations honoring the **ObjectUri** system.

---

## Table of Contents
1. [Instantiation & Registry Registration](#1-instantiation--registry-registration)
2. [Default Provider vs Named Provider with ObjectUri](#2-default-provider-vs-named-provider-with-objecturi)
3. [Token Verification & User Metadata](#3-token-verification--user-metadata)

---

## 1. Instantiation & Registry Registration

All authentication adapters in Quatrain inherit from `AbstractAuthAdapter` and are registered into the global `Auth` registry.

```typescript
import { Auth } from '@quatrain/auth'
import { SupabaseAuthAdapter } from '@quatrain/auth-supabase'

// 1. Instantiate the Supabase auth adapter
const supabaseAdapter = new SupabaseAuthAdapter({
  config: {
    supabaseUrl: process.env.SUPABASE_URL || 'https://xyz.supabase.co',
    supabaseKey: process.env.SUPABASE_KEY || 'your-supabase-key'
  }
})

// 2. Register into the Auth registry
// Setting setDefault = true marks this adapter as the primary authentication provider
Auth.addProvider(supabaseAdapter, 'supabase', true)
```

---

## 2. Default Provider vs Named Provider with ObjectUri

Quatrain represents identity subjects as **ObjectUri** references (`[provider:]users/uid`) across multiple identity providers (OAuth, Supabase, LDAP, Basic Auth).

### A. Calling the Default Provider

When verifying tokens or performing standard authentication, calling `Auth.getProvider()` without arguments resolves to `Auth.defaultProvider`:

```typescript
// Resolves the default provider (e.g. 'supabase')
const defaultAuth = Auth.getProvider()

// Verify an incoming JWT bearer token
const user = await defaultAuth.verifyToken(bearerToken)
console.log(`Authenticated UID: ${user.id}`)
```

### B. Calling a Specific Provider Respecting ObjectUri

When multiple providers are registered (e.g., primary `supabase` and secondary `basic`), you can inspect the subject's `ObjectUri` to route authorization requests:

```typescript
import { Auth } from '@quatrain/auth'
import { ObjectUri } from '@quatrain/core'

// Subject URI representing a Supabase-managed identity
const subjectUri = new ObjectUri('supabase:users/usr-789')

// 1. Extract the target auth provider from the ObjectUri
const targetProvider = subjectUri.backend || Auth.defaultProvider // 'supabase'

// 2. Retrieve the provider from the registry
const auth = Auth.getProvider(targetProvider)

// 3. Perform provider-specific user operations
console.log(`Targeting provider: ${targetProvider} for user ${subjectUri.uid}`)
```

---

## 3. Token Verification & User Metadata

Supabase stores user custom attributes inside the `raw_user_meta_data` field. The adapter normalizes this metadata onto the returned user object:

```typescript
import { Auth } from '@quatrain/auth'

async function greetUser(token: string) {
  const auth = Auth.getProvider('supabase')
  const user = await auth.verifyToken(token)

  // Normalized metadata access
  console.log(`Hello, ${user.metadata?.full_name || user.email}`)
}
```
