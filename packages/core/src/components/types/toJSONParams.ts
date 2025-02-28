export type toJSONParams = {
   // Return objects as references
   objectsAsReferences?: boolean
   // Exclude URI data (uid, patch, etc.)
   withoutURIData?: boolean
   // Ignore property which value has not been changed
   ignoreUnchanged?: boolean
   // Ignore property which value is null
   ignoreNulls?: boolean
   // map of property values converters
   converters?: { [propType: string]: Function }
}
