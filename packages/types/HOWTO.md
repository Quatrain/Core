# HOWTO: Using @quatrain/types

This document shows how to utilize the reference URI systems and resource exceptions.

---

## 1. Using ObjectUri

The `ObjectUri` system helps identify database records and references:

```typescript
import { ObjectUri } from '@quatrain/types';

// Instantiate from a path string
const uri = new ObjectUri('users/usr-100');

console.log(uri.uid);         // "usr-100"
console.log(uri.collection);  // "users"
console.log(uri.path);        // "users/usr-100"

// Bind class instance directly to compute path
uri.class = User;
```

## 2. Using Exceptions

Import and throw Quatrain resource errors to automate error responses:

```typescript
import { NotFoundError, ValidationError } from '@quatrain/types';

// Resource lookup failures
throw new NotFoundError('User could not be found.');

// validation failures
throw new ValidationError('Validation failed', {
   email: 'Invalid email address format'
});
```
