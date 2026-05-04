# @quatrain/backend-restapi

A scalable and flexible backend adapter for integrating Quatrain applications with remote REST APIs.

## Overview
This package provides `RestBackendAdapter`, which implements the `AbstractBackendAdapter` interface. It translates Quatrain's standard CRUD methods (`create`, `read`, `update`, `delete`, `find`) into RESTful HTTP requests using the `@quatrain/api-client`.

## Features
- **Configurable Endpoints**: Map models directly to specific endpoints via `endpointMap`.
- **Method Restrictions**: Explicitly define `allowedMethods` to prevent unsupported CRUD actions.
- **Dynamic Querying**: Customize how Quatrain `Filters` and `SortAndLimit` map to query strings via the `querySerializer`.
- **Authentication**: Native support for Basic, Bearer, and generic OAuth via the API Client.

## Basic Usage

```typescript
import { RestBackendAdapter } from '@quatrain/backend-restapi'
import { BearerAuthProvider } from '@quatrain/api-client'

const restAdapter = new RestBackendAdapter({
   baseUrl: 'https://api.example.com/v1',
   endpointMap: {
      'User': '/users',
      'Post': '/posts'
   },
   allowedMethods: ['read', 'find', 'create'], // Disallow update/delete
   authProvider: new BearerAuthProvider('my-token'),
   querySerializer: (filters, pagination) => {
      // Custom filter mapping...
      return { offset: pagination?.limits.offset, limit: pagination?.limits.batch }
   }
})

// Use the adapter in your Backend initialization
Backend.init(restAdapter)
```

## Extending
For complex integrations, you can extend the adapter:
```typescript
class CustomRestAdapter extends RestBackendAdapter {
   protected buildUrl(collectionName: string, uid?: string): string {
      // Custom URL logic
      return super.buildUrl(collectionName, uid)
   }
}
```

## Recipes
See the `@quatrain/backend-restapi-recipes` package for community-maintained query serializers for famous APIs (OpenWeatherMap, CoinGecko, etc.).
