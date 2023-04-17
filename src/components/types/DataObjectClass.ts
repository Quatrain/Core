import { ObjectUri } from '../ObjectUri'

export interface DataObjectClass {
   uri: ObjectUri
   uid: any
   backend: any
   path: any
   class: any
   properties: any
   setProperties(properties: any): void
   populate(data: any): Promise<DataObjectClass>
   isPopulated(): boolean
   isPersisted(): boolean
   get(key: string): any
   set(key: string, val: any): any
   val(key: string): any
   read(): Promise<DataObjectClass>
   save(): Promise<DataObjectClass>
   clone(data?: any): Promise<DataObjectClass>
   toReference(): any
   toJSON(): any
}
