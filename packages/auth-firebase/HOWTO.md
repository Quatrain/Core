# How To: Using @quatrain/auth-firebase

This guide covers Firebase-specific auth operations.

## Table of Contents
1. [Custom Claims](#1-custom-claims)

---

## 1. Custom Claims

Firebase allows attaching custom claims to a user's token (e.g., for roles). The adapter's `verifyToken` method will parse these and make them available in the normalized user object.

```typescript
import { Auth } from '@quatrain/auth'

async function checkAdminStatus(token: string) {
    const auth = Auth.getAdapter('firebase')
    const user = await auth.verifyToken(token)
    
    // User claims are exposed
    if (user.claims && user.claims.admin) {
        console.log('User is an admin')
    } else {
        console.log('Regular user')
    }
}
```
