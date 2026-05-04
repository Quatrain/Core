import { Filters, Filter, SortAndLimit } from '@quatrain/backend'
import { RestAdapterOptions, QuerySerializer } from '@quatrain/backend-restapi'
import { RestApiRecipe } from './RestApiRecipe'

export class CoinGeckoRecipe implements RestApiRecipe {
   public name = 'CoinGecko'
   public defaultBaseUrl = 'https://api.coingecko.com/api/v3'

   public querySerializer: QuerySerializer = (filters: Filters | Filter[] | undefined, pagination: SortAndLimit | undefined) => {
      const params: Record<string, string> = {
         vs_currency: 'usd'
      }

      if (pagination && pagination.limits) {
         if (pagination.limits.batch) params['per_page'] = String(pagination.limits.batch)
         // Offset usually translates to page in these APIs: page = (offset / limit) + 1
         if (pagination.limits.offset && pagination.limits.batch) {
            params['page'] = String(Math.floor(pagination.limits.offset / pagination.limits.batch) + 1)
         }
      }

      if (filters) {
         const filterArray = Array.isArray(filters) ? filters : [filters]
         for (const f of filterArray) {
            if ('property' in f && 'value' in f) {
               if (f.property === 'ids') params['ids'] = String(f.value)
            }
         }
      }

      return params
   }

   public getOptions(overrides?: Partial<RestAdapterOptions>): RestAdapterOptions {
      return {
         baseUrl: this.defaultBaseUrl,
         querySerializer: this.querySerializer,
         ...overrides
      }
   }
}
