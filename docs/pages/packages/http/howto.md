# HOWTO: Using @quatrain/http

This document outlines how to use the HTTP enums and header parsing helper functions.

---

## 1. Using Enums

Import standard headers, methods, and status codes to avoid hardcoding strings:

```typescript
import { HttpHeader, HttpMethod, HttpStatus } from '@quatrain/http';

console.log(HttpMethod.GET); // "GET"
console.log(HttpStatus.OK); // 200
console.log(HttpHeader.AUTHORIZATION); // "Authorization"
```

## 2. Parsing Authorization Headers

Use `HttpHelper` to decode header credentials safely:

```typescript
import { HttpHelper } from '@quatrain/http';

// Bearer tokens
const token = HttpHelper.parseBearerToken('Bearer xyz123');
console.log(token); // "xyz123"

// Basic credentials
const credentials = HttpHelper.parseBasicAuth('Basic YWRtaW46cGFzczEyMw==');
if (credentials) {
   console.log(credentials.user); // "admin"
   console.log(credentials.pass); // "pass123"
}
```
