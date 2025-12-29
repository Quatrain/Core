# @quatrain/auth-firebase

An authentication adapter for Firebase Authentication. This package integrates Quatrain's auth system with Google's managed authentication service.

## Features

-  Implements the `@quatrain/auth` abstract adapter.
-  Supports email/password, social logins (Google, Facebook, etc.), and custom tokens.
-  Integrates with Firebase security rules.
-  Uses the `firebase-admin` SDK for server-side operations.

## Installation

```bash
npm install @quatrain/auth-firebase firebase-admin
```

## Usage

### Setup

```typescript
import { Auth } from '@quatrain/auth'
import { FirebaseAuthAdapter } from '@quatrain/auth-firebase'

const adapter = new FirebaseAuthAdapter({
   config: {
      projectId: 'your-project-id',
      // Other Firebase Admin SDK config
      apiKey: 'your-api-key', // Required for token refresh
   },
})
Auth.addProvider(adapter, 'default', true)
```

### Register a New User

```typescript
import { User } from '@quatrain/backend'

const user = new User({
   uid: 'unique-user-id',
   _: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
   },
})

const userId = await adapter.register(user, 'password123')
console.log('User registered with ID:', userId)
```

### Verify Auth Token

```typescript
const decodedToken = await adapter.getAuthToken('firebase-id-token')
console.log('Token verified for user:', decodedToken.uid)
```

### Update User Profile

```typescript
await adapter.update(user, {
   email: 'newemail@example.com',
   displayName: 'Jane Doe',
   phoneNumber: '+0987654321',
})
```

### Delete User

```typescript
await adapter.delete(user)
console.log('User deleted')
```

### Refresh Token

```typescript
const newTokens = await adapter.refreshToken(refreshToken)
console.log('New access token:', newTokens.access_token)
```

> [!WARNING] > **Incomplete Implementation**
>
> The following methods are currently not implemented (empty stubs):
>
> -  `signup()` - Client-side sign in
> -  `signout()` - Sign out user
> -  `revokeAuthToken()` - Revoke tokens
> -  `setCustomUserClaims()` - Set custom claims
>
> These methods exist to satisfy the interface but do not perform any operations.
