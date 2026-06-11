# How To: Using @quatrain/auth

This guide demonstrates how to secure your application using the Quatrain authentication abstraction.

## Table of Contents
1. [Registering an Auth Adapter](#1-registering-an-auth-adapter)
2. [Verifying Tokens](#2-verifying-tokens)

---

## 1. Registering an Auth Adapter

Configure the adapter once during application startup.

```typescript
import { Auth } from '@quatrain/auth'
import { FirebaseAuthAdapter } from '@quatrain/auth-firebase'

const authAdapter = new FirebaseAuthAdapter({
    config: { /* Firebase credentials */ }
})

// Register as the default auth provider
Auth.addAdapter('default', authAdapter, true)
```

## 2. Verifying Tokens

Use the adapter in your API middleware to protect routes.

```typescript
import { Auth } from '@quatrain/auth'

async function authenticateRequest(req, res, next) {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send('Unauthorized')
    }
    
    const token = authHeader.split(' ')[1]
    const auth = Auth.getAdapter()
    
    try {
        // verifyToken returns a normalized user object
        const user = await auth.verifyToken(token)
        req.user = user // Attach to request context
        next()
    } catch (err) {
        res.status(403).send('Invalid token')
    }
}
```
