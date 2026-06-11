# How To: Using @quatrain/auth-pocketbase

This guide demonstrates how to configure and use the PocketBase Authentication adapter for Quatrain Core.

## 1. Local PocketBase Instance Setup

To test authentication locally, you will need to run a local instance of PocketBase.

### Download & Run
1. Go to the [PocketBase download page](https://pocketbase.io/docs/) and download the prebuilt binary for your OS.
2. Extract the archive.
3. Open a terminal in the extracted directory and start the server:
   ```bash
   ./pocketbase serve
   ```
4. Access the Admin UI at `http://127.0.0.1:8090/_/` and create your first admin account.
5. In the Admin UI, go to **Collections > users**, click the **Settings** icon (gear) for the users collection, and ensure that **Options > Allow email auth** is enabled.

## 2. Registering the PocketBase Auth Adapter

Configure the adapter once during application startup.

```typescript
import { Auth } from '@quatrain/auth'
import { PocketBaseAuthAdapter } from '@quatrain/auth-pocketbase'

const authAdapter = new PocketBaseAuthAdapter({
    config: { 
        url: 'http://127.0.0.1:8090' 
    }
})

// Register as the default auth provider
Auth.addAdapter(authAdapter, 'default', true)
```

## 3. Usage

The `PocketBaseAuthAdapter` integrates seamlessly with Quatrain's standard Auth API.
When calling `Auth.getProvider().signup()`, it connects directly to your PocketBase instance to authenticate users.
