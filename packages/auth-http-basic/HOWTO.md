# HOWTO: Using @quatrain/auth-http-basic

This document shows how to configure and run the Basic Authentication middleware inside your Quatrain API.

---

## 1. Initializing AuthBasic

Create a new basic auth verifier manually or via its `factory` method:

```typescript
import { AuthBasic } from '@quatrain/auth-http-basic';

// Manually
const auth = new AuthBasic('admin', 'super-secret-password');

// Or from a configuration object
const configAuth = AuthBasic.factory({
   user: 'admin',
   pass: 'super-secret-password'
});
```

## 2. Registering the Middleware

Register the verifier's middleware on your Quatrain API instance:

```typescript
import { Api } from '@quatrain/api';

const api = new Api();
api.use(auth.middleware());
```
