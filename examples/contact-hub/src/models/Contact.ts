import { PersistedBaseObject } from '@quatrain/backend'
import {
   Core,
   StringProperty,
   BaseObjectProperties,
   BaseObjectType,
   htmlType,
   ValidationError,
} from '@quatrain/core'

/**
 * TypeScript interface defining the shape of a Contact data object.
 */
export interface ContactType extends BaseObjectType {
   name: string
   email?: string
   company?: string
   notes?: string
}

/**
 * Declarative property schema definition for the Contact entity.
 */
export const ContactProperties = [
   ...BaseObjectProperties,
   {
      name: 'name',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      fullSearch: true,
      htmlType: htmlType.NAME,
   },
   {
      name: 'email',
      mandatory: false,
      type: StringProperty.TYPE,
      maxLength: 255,
      fullSearch: true,
      htmlType: htmlType.EMAIL,
   },
   {
      name: 'company',
      mandatory: false,
      type: StringProperty.TYPE,
      maxLength: 100,
      fullSearch: true,
      htmlType: htmlType.ORG,
   },
   {
      name: 'notes',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXTAREA,
   },
]

/**
 * Domain model representing a Contact within the sovereign Contact & Task Hub.
 * Extends `PersistedBaseObject` to provide declarative schema validation and database portability.
 */
export class Contact extends PersistedBaseObject {
   /** Schema definition for Contact properties. */
   static PROPS_DEFINITION = ContactProperties

   /** The database collection or table name. */
   static COLLECTION = 'contacts'

   /**
    * Instantiates a Contact model from raw data, ObjectUri, or path.
    *
    * @param src - Raw data dictionary, ObjectUri, or backend path.
    * @returns A promise resolving to the Contact instance.
    */
   static async factory(src?: any): Promise<Contact> {
      return super.factory(src, Contact)
   }

   /**
    * Validates model integrity and email format constraints.
    *
    * @throws {ValidationError} When required fields are missing or email format is invalid.
    */
   validate(): void {
      super.validate()

      const email = this.dataObject.val('email')
      if (email && typeof email === 'string') {
         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
         if (!emailRegex.test(email)) {
            throw new ValidationError('Validation failed', {
               email: 'Invalid email format',
            })
         }
      }
   }
}

Core.addClass('Contact', Contact)
