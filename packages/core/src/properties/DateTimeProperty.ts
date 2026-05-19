import { BaseProperty, BasePropertyType } from './BaseProperty'

/**
 * Configuration dictionary for instantiating a `DateTimeProperty`.
 * Extends `BasePropertyType` to handle date and time manipulations.
 *
 * | Parameter | Type | Description | Default |
 * | :--- | :--- | :--- | :--- |
 * | `timezone` | string | The timezone string (e.g. 'UTC', 'Europe/Paris', or 'Z'). | `'Z'` |
 */
export interface DateTimePropertyType extends BasePropertyType {
   timezone?: string
}

/**
 * A property type that manages Dates, Timestamps, and ISO date strings.
 * It automatically parses strings and standardizes UTC conversions depending on the global `RETURN_AS` setting.
 * 
 * @example
 * ```typescript
 * const createdAt = new DateTimeProperty({
 *    name: 'createdAt',
 *    timezone: 'UTC'
 * });
 * 
 * createdAt.set(new Date()); // Will store as UNIX timestamp if RETURN_AS is configured
 * console.log(createdAt.val());
 * ```
 */
export class DateTimeProperty extends BaseProperty {
   /** Return behavior to return the original Date object or string as is. */
   static AS_IS = 'asis'
   /** Return behavior to auto-convert dates into numeric UNIX timestamps. */
   static UNIX_TIMESTAMP = 'unix_timestamp'

   /** The string literal type identifier for this property. */
   static TYPE = 'datetime'

   /** Global configuration determining the default format returned by `val()`. */
   static RETURN_AS: string = DateTimeProperty.AS_IS

   protected _timezone: string

   constructor(config: DateTimePropertyType) {
      super(config)
      this._timezone = config.timezone || 'Z'
   }

   /**
    * Assigns a new date value. If `RETURN_AS` is set to `unix_timestamp`, 
    * strings and JS Date objects are automatically parsed and converted to UNIX timestamps (milliseconds).
    * 
    * @param value - The date string, timestamp, or Date object to assign.
    * @param setChanged - Whether to mark the property as modified.
    * @returns The property instance for chaining.
    */
   set(value: string | Date | number, setChanged = true) {
      if (value && DateTimeProperty.RETURN_AS === 'unix_timestamp') {
         if (typeof value === 'string') {
            // Parse date strings as UTC
            // If the string already has timezone info (ends with Z or +/-offset), use as-is
            // Otherwise, treat as UTC by appending 'Z'
            let utcString = value.trim()
            if (
               !utcString.endsWith('Z') &&
               !/[+-]\d{2}(:?\d{2})?$/.test(utcString)
            ) {
               // Replace space with T for ISO format and append Z for UTC
               utcString = utcString.replace(' ', 'T') + 'Z'
            }
            value = Date.parse(utcString)
         } else if (typeof value === 'object') {
            value = (value as Date).getTime()
         }
      }
      return super.set(value, setChanged)
   }

   get timezone() {
      return this._timezone
   }
}
