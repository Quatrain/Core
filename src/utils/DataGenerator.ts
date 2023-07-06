import { Core } from '../Core'
import { BaseObject } from '../components/BaseObjectProperties'
import * as htmlType from '../properties/types/PropertyHTMLType'
import { faker } from '@faker-js/faker'
import { Proxy } from '../components/types/ProxyConstructor'

/**
 * Generate data from model of object and save it in default backend
 * @param model
 * @param qty
 * @param forcedValues
 * @returns
 */
export const DataGenerator = async <T extends BaseObject>(
   model: Proxy<T>,
   qty: number = 5,
   forcedValues: any = {}
): Promise<any> => {
   const promises: any = []
   Core.log(`Starting to create ${qty} ${model.constructor.name} records`)
   for (let i = 0; i < qty; i++) {
      const dao = await model.core.dataObject.clone() //model.dataObject.toJSON())

      Object.keys(dao.properties).forEach((key) => {
         const property = dao.get(key)

         if (forcedValues[key]) {
            property.set(forcedValues[key])
            return
         }

         switch (property.constructor.name) {
            case 'StringProperty':
               switch (property.htmlType) {
                  case htmlType.GIVEN_NAME:
                     property.set(faker.name.firstName())
                     break
                  case htmlType.FAMILY_NAME:
                     property.set(faker.name.lastName())
                     break
                  case htmlType.EMAIL:
                     property.set(faker.helpers.unique(faker.internet.email))
                     break
                  case htmlType.ORG:
                     property.set(faker.company.name())
                  default:
                     property.set(faker.word.noun())
                     break
               }
               break

            case 'EnumProperty':
               property.set(faker.helpers.arrayElement(property.values))
               break

            case 'HashProperty':
               property.set(faker.random.alphaNumeric(16))
               break

            case 'DateTimeProperty':
               switch (property.htmlType) {
                  case htmlType.BIRTHDAY:
                     property.set(faker.date.birthdate())
                     break
                  default:
                     //property.set(faker.date.future())
                     break
               }
               break

            default:
               break
         }
      })

      await dao.save()
      promises.push(dao)
   }

   return promises
}
