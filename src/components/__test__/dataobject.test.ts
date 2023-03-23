import { properties, fClass, fData } from './fixtures/dao'
import { DataObject } from '../DataObject'
import { MockAdapter } from '../../backends/MockAdapter'
import { ObjectUri } from '../ObjectUri'

MockAdapter.inject(fData)

describe('Data object', () => {
   test('has properties that are instances', () =>
      DataObject.factory(fClass.prototype, properties).then((dao) => {
         expect(dao.get('string').constructor.name).toBe('StringProperty')
         expect(dao.get('boolean').constructor.name).toBe('BooleanProperty')
         expect(dao.get('enum').constructor.name).toBe('EnumProperty')
         expect(dao.get('object').constructor.name).toBe('ObjectProperty')
      }))

   test('has a class name', () =>
      DataObject.factory(fClass.prototype, properties).then((dao) => {
         expect(dao.class).toBe(fClass.prototype)
      }))

   test('can set its uri from a string or an ObjectUri', () => {
      DataObject.factory(fClass.prototype, properties).then((dao) => {
         dao.uri = 'a/b'
         expect(dao.uri.constructor.name).toBe('ObjectUri')
         dao.uri = new ObjectUri('a/b')
         expect(dao.uri.constructor.name).toBe('ObjectUri')
      })
   })

   test('can provide default values of props', () => {
      DataObject.factory(fClass.prototype, properties)
         .then((dao) => {
            expect(dao.val('string')).toEqual('nothing')
            expect(dao.val('boolean')).toEqual(false)
            expect(dao.val('enum')).toEqual(undefined)
            expect(dao.val('object')).toEqual(undefined)
         })
         .catch((e) => console.log(e))
   })

   test('can be populated with data', () => {
      DataObject.factory(fClass.prototype, properties).then((dao) => {
         dao.uri = fData.uid
         dao.read()
            .then(() => {
               expect(dao.isPopulated()).toBe(true)
               expect(dao.val('string')).toEqual('a string')
               expect(dao.val('boolean')).toEqual(true)
               expect(dao.val('enum')).toEqual('Miss')
               expect(dao.val('object').constructor.name).toEqual('ObjectUri')
            })
            .catch((e) => console.log(e))
      })
   })
})
