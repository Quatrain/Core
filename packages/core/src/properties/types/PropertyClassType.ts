import { AbstractPropertyType } from './AbstractPropertyType'

export interface PropertyClassType {
   id?: string
   name: string
   set(value: any, setChanged?: boolean): AbstractPropertyType
   val(transform?: any): any
   toJSON(): any
   clone(): PropertyClassType
   hasChanged?: boolean
}
