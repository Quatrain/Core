import { AbstractPropertyType } from "./AbstractPropertyType"

export interface PropertyClassType {
   set(value: any): AbstractPropertyType
   val(transform: any): any
   toJSON(): any
}
