import { BaseObjectCore } from '../components'
import { DataObjectProperties } from '../properties'

export function $model<T extends DataObjectProperties>(
   collection: string,
   properties: T
): typeof BaseObjectCore {
   class Model extends BaseObjectCore {
      static COLLECTION: string = collection
      PROPS_DEFINITION: DataObjectProperties = properties
   }

   return Model
}
