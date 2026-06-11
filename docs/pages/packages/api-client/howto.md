# HOWTO: Using @quatrain/api-client

The `ApiClient` is a singleton pattern class designed to unify HTTP requests across the application.

## 1. Initializing the Client

You must provide a base URL when initializing the instance:

```typescript
import { ApiClient } from '@quatrain/api-client';

const API_BASE_URL = 'http://localhost:4000/api';
const apiClient = ApiClient.instance(API_BASE_URL);
```

## 2. Making Requests

The client provides helper methods for standard REST operations. All methods return a standard `ApiPayload` wrapper containing `data` and `meta`.

### GET
```typescript
// Fetch a list (with query parameters)
const response = await apiClient.get('models', { offset: 0, batch: 50 });
console.log(response.data); 

// Fetch a single item
const model = await apiClient.get(`models/${id}`);
```

### POST
```typescript
// Create a new resource
const newModel = await apiClient.post('models', {
   name: 'User',
   collectionName: 'users'
});
```

### PUT
```typescript
// Update an existing resource
await apiClient.put(`models/${id}`, {
   isPersisted: true
});
```

### DELETE
```typescript
// Delete a resource
await apiClient.delete(`models/${id}`);
```

## 3. Using Authentication
If your API requires authentication, you can pass an `AuthProvider` instance to the `ApiClient`.

```typescript
import { AuthProvider } from '@quatrain/api-client';

class MyAuthProvider extends AuthProvider {
   getToken() {
      return localStorage.getItem('token');
   }
}

apiClient.authProvider = new MyAuthProvider();
// All subsequent requests will include the 'Authorization: Bearer <token>' header.
```
