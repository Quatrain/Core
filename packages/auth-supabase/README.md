# @quatrain/auth-supabase

An authentication adapter for Supabase Auth. This package provides a seamless integration between Quatrain and Supabase's GoTrue-based authentication service.

## Features

-  Implements the `@quatrain/auth` abstract adapter.
-  Works with both Supabase SaaS and self-hosted instances.
-  Leverages Supabase's Row-Level Security (RLS) for data access.
-  Uses the `@supabase/supabase-js` library.

## Installation

```bash
npm install @quatrain/auth-supabase @supabase/supabase-js
```

## Usage

### Setup

```typescript
import { Auth } from '@quatrain/auth'
import { SupabaseAuthAdapter } from '@quatrain/auth-supabase'

const adapter = new SupabaseAuthAdapter({
   config: { supabaseUrl: '...', supabaseKey: '...' },
})
Auth.addProvider(adapter, 'default', true)
```

### Register a New User

```typescript
import { User } from '@quatrain/backend'

const user = new User({
   _: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
   },
})

const supabaseUser = await adapter.register(user, 'password123')
console.log('User registered:', supabaseUser.id)
```

### Sign In

```typescript
const result = await adapter.signup('john@example.com', 'password123')
if (result) {
   console.log('Signed in:', result.user)
   console.log('Session token:', result.session.access_token)
}
```

### Sign Out

```typescript
const success = await adapter.signout()
console.log('Signed out:', success)
```

### Update User Profile

```typescript
await adapter.update(user, {
   email: 'newemail@example.com',
   phone: '+0987654321',
})
```

### Refresh Token

```typescript
const newTokens = await adapter.refreshToken(refreshToken)
console.log('New access token:', newTokens.access_token)
```

### Set Custom User Claims

```typescript
await adapter.setCustomUserClaims(userId, {
   role: 'admin',
   permissions: ['read', 'write', 'delete'],
})
```
