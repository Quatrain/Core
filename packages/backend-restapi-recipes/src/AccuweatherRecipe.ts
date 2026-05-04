import { Filters, Filter, SortAndLimit } from '@quatrain/backend'
import { RestAdapterOptions, QuerySerializer } from '@quatrain/backend-restapi'
import { RestApiRecipe } from './RestApiRecipe'

export class AccuweatherRecipe implements RestApiRecipe {
   public name = 'AccuWeather'
   public defaultBaseUrl = 'http://dataservice.accuweather.com'

   private apiKey: string

   constructor(apiKey: string) {
      this.apiKey = apiKey
   }

   public querySerializer: QuerySerializer = (filters: Filters | Filter[] | undefined, pagination: SortAndLimit | undefined) => {
      const params: Record<string, string> = {
         apikey: this.apiKey,
         language: 'en-us',
         details: 'true'
      }

      if (filters) {
         const filterArray = Array.isArray(filters) ? filters : [filters]
         for (const f of filterArray) {
            if ('property' in f && 'value' in f) {
               // AccuWeather often uses 'q' for location searches
               if (f.property === 'q' || f.property === 'city') params['q'] = String(f.value)
               // For geocoding or specific keys
               if (f.property === 'locationKey') params['locationKey'] = String(f.value)
            }
         }
      }

      return params
   }

   public getOptions(apiKey?: string, overrides?: Partial<RestAdapterOptions>): RestAdapterOptions {
      return {
         baseUrl: this.defaultBaseUrl,
         querySerializer: this.querySerializer,
         ...overrides
      }
   }
}
