import { BaseProperty, BasePropertyType } from './BaseProperty'

export interface DateTimePropertyType extends BasePropertyType {
   timezone?: string
}

export class DateTimeProperty extends BaseProperty {
   static AS_IS = 'asis'
   static UNIX_TIMESTAMP = 'unix_timestamp'

   static TYPE = 'datetime'

   static RETURN_AS: string = DateTimeProperty.AS_IS

   protected _timezone: string

   constructor(config: DateTimePropertyType) {
      super(config)
      this._timezone = config.timezone || 'Z'
   }

   set(value: string | Date | number, setChanged = true) {
      if (value && DateTimeProperty.RETURN_AS === 'unix_timestamp') {
         if (typeof value === 'string') {
            // Parse date strings as UTC
            // If the string already has timezone info (ends with Z or +/-offset), use as-is
            // Otherwise, treat as UTC by appending 'Z'
            let utcString = value.trim()
            if (
               !utcString.endsWith('Z') &&
               !/[+-]\d{2}:\d{2}$/.test(utcString)
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
