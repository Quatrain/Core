# How To: Using @quatrain/auth-supabase

This guide covers Supabase-specific auth operations.

## Table of Contents
1. [User Metadata](#1-user-metadata)

---

## 1. User Metadata

Supabase stores user data inside the `raw_user_meta_data` field. The adapter normalizes this so it's easily accessible after verifying the token.

```typescript
import { Auth } from '@quatrain/auth'

async function greetUser(token: string) {
    const auth = Auth.getAdapter('supabase')
    const user = await auth.verifyToken(token)
    
    // Normalized access to Supabase metadata
    console.log(`Hello, ${user.metadata.full_name}`)
}
```
