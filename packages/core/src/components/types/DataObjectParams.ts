import { DataObjectProperties } from '../../properties'
import { ObjectUri } from '../ObjectUri'

export interface DataObjectParams {
   uri?: string | ObjectUri
   properties: DataObjectProperties
   parentProp?: string
}
