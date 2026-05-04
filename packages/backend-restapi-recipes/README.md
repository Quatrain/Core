# @quatrain/backend-restapi-recipes

A collection of pre-configured integration recipes for the Quatrain `RestBackendAdapter`.

## Overview
REST APIs have wildly different standards for pagination, filtering, and authentication. Instead of forcing developers to reinvent the wheel, this package provides standardized `RestApiRecipe` implementations tailored for popular public APIs.

## Available Recipes
- **OpenWeatherMap**: Maps `city`, `lat`, and `lon` filters to the appropriate query strings (`q`, `lat`, `lon`), and automatically injects the `appid` key.
- **AccuWeather**: Translates location searches (`q`, `city`, `locationKey`) and automatically injects `apikey`, `language`, and `details=true`.
- **CoinGecko**: Translates standard Quatrain pagination into CoinGecko's `page` and `per_page` query parameters.

## Basic Usage

```typescript
import { RestBackendAdapter } from '@quatrain/backend-restapi'
import { CoinGeckoRecipe } from '@quatrain/backend-restapi-recipes'

// 1. Instantiate the desired recipe
const recipe = new CoinGeckoRecipe()

// 2. Fetch the pre-configured options and pass them to the adapter
const restAdapter = new RestBackendAdapter(recipe.getOptions({
   // You can override or add specific options here
   allowedMethods: ['find', 'read']
}))

Backend.init(restAdapter)
```

## Contributing
We welcome contributions! To add a new recipe:
1. Create a class implementing the `RestApiRecipe` interface.
2. Ensure your `querySerializer` accurately translates Quatrain `Filters` into the target API's expected query string parameters.
3. Write comprehensive unit tests for your implementation.
