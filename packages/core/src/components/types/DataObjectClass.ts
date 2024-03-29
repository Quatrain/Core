import { PropertyClassType } from '../../properties/types/PropertyClassType'
import { ObjectUri } from '../ObjectUri'

export interface DataObjectClass<T extends DataObjectClass<any>> {
   uri: ObjectUri
   uid: any
   backend: any
   path: any
   class: any
   properties: any
   parentProp: string | undefined

   setProperties(properties: any): void
   addProperty(property: PropertyClassType): void
   populate(data?: any): Promise<T>
   isPopulated(): boolean
   isPersisted(): boolean
   has(key: string): boolean
   get(key: string): any
   set(key: string, val: any): any
   val(key: string): any
   read(): Promise<T>
   save(): Promise<T>
   delete(): Promise<T>
   clone(data?: any): Promise<T>
   toReference(): any
   toJSON(objectsAsReferences?: boolean): any
   populateFromData(data: { [x: string]: unknown }): this
   asProxy(): any
}
