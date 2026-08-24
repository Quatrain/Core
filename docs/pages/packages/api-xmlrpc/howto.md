# HOWTO: Using @quatrain/api-xmlrpc

This document shows how to initialize and use the XML-RPC client wrapper.

---

## 1. Initializing the Client

Provide target connection options to instantiate `XmlRpcClient`:

```typescript
import { XmlRpcClient } from '@quatrain/api-xmlrpc';

const client = new XmlRpcClient({
  host: 'odoo.example.com',
  port: 443,
  path: '/xmlrpc/2/common',
  secure: true
});
```

## 2. Invoking Remote Methods

Use the `methodCall` method to execute calls asynchronously. It returns a Promise:

```typescript
try {
  const version = await client.methodCall('version', []);
  console.log('Odoo Version Details:', version);
} catch (err) {
  console.error('Connection failed:', err);
}
```
