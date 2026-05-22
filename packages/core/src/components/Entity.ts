import { BaseObject } from './BaseObject'
import { BaseObjectProperties } from './BaseObjectProperties'
import { User } from './User'
import { CollectionProperty } from '../properties/CollectionProperty'
import { StringProperty } from '../properties/StringProperty'
import * as htmlType from '../properties/types/PropertyHTMLType'
import { BaseObjectType } from './types/BaseObjectType'

export interface EntityType extends BaseObjectType {
   users?: User[]
}

/**
 * Represents a generic grouping structure, such as a company or organization, 
 * to which Users may be associated.
 */
export class Entity extends BaseObject {
   /** Base collection scope name. */
   static COLLECTION = 'entities'

   /** Component structure declaration. */
   static PROPS_DEFINITION = [
      ...BaseObjectProperties,
      {
         // surcharge property minLength and htmlType
         name: 'name',
         type: StringProperty.TYPE,
         mandatory: true,
         minLength: 1,
         htmlType: htmlType.ORG,
      },
      {
         name: 'users',
         mandatory: false,
         type: CollectionProperty.TYPE,
         instanceOf: User,
         parentKey: 'entity',
      },
   ]

   /**
    * Entity creation factory.
    * 
    * @param src - Identifier or content array.
    * @returns The generated Entity instance.
    */
   static async factory(src: any = undefined): Promise<Entity> {
      return super.factory(src, Entity)
   }
}
