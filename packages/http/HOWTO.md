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

## 3. MessagePack Content Negotiation

`msgPackContentNegotiation` is a framework-agnostic middleware (Express, Connect...):

```typescript
import express from 'express';
import { MSGPACK_CONTENT_TYPES, msgPackContentNegotiation } from '@quatrain/http';

const app = express();
app.use(express.raw({ type: MSGPACK_CONTENT_TYPES, limit: '50mb' }), msgPackContentNegotiation);
```

- Requests with `Content-Type: application/x-msgpack` (or `application/msgpack`) are decoded into
  `req.body`. The body must be read as a raw `Buffer` first, as `express.raw()` does above.
- Responses sent with `res.json()` / `res.send()` are encoded as MessagePack when the client sends
  `Accept: application/x-msgpack` or `?format=msgpack`.

This package only negotiates the format and encodes. The MessagePack wire contract is owned by
`normalizeForMsgPack()` in `@quatrain/core`, which is applied to every payload whatever produced it:
`toMsgPack()` / `toJSON()` are called, every `ref` key is emitted as `path` at any depth (`ref` is a
reserved keyword in several client languages) and `null` values are omitted. Handlers therefore
need no MessagePack-specific code.
