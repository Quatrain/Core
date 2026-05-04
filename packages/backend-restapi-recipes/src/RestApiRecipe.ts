import { RestAdapterOptions, QuerySerializer } from '@quatrain/backend-restapi'

export interface RestApiRecipe {
   /**
    * Name of the recipe
    */
   name: string

   /**
    * The default base URL for the API (if applicable)
    */
   defaultBaseUrl?: string

   /**
    * The query serializer that translates Quatrain Filters to the API's expected query strings
    */
   querySerializer: QuerySerializer
   
   /**
    * Provides the default RestAdapterOptions for this recipe.
    * Users can spread this over their own options.
    */
   getOptions(apiKey?: string, overrides?: Partial<RestAdapterOptions>): RestAdapterOptions
}
