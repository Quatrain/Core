import { Filters, Filter, SortAndLimit } from '@quatrain/backend'
import { RestAdapterOptions, QuerySerializer } from '@quatrain/backend-restapi'
import { RestApiRecipe } from './RestApiRecipe'

export class OpenWeatherMapRecipe implements RestApiRecipe {
   public name = 'OpenWeatherMap'
   public defaultBaseUrl = 'https://api.openweathermap.org/data/2.5'

   private apiKey: string

   constructor(apiKey: string) {
      this.apiKey = apiKey
   }

   public querySerializer: QuerySerializer = (filters: Filters | Filter[] | undefined, pagination: SortAndLimit | undefined) => {
      const params: Record<string, string> = {
         appid: this.apiKey,
         units: 'metric' // Default to metric
      }

      if (filters) {
         // Very simplistic filter mapping for PoC
         const filterArray = Array.isArray(filters) ? filters : [filters]
         for (const f of filterArray) {
            if ('property' in f && 'value' in f) {
               // f is a Filter
               if (f.property === 'city' || f.property === 'q') params['q'] = String(f.value)
               if (f.property === 'lat') params['lat'] = String(f.value)
               if (f.property === 'lon') params['lon'] = String(f.value)
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
