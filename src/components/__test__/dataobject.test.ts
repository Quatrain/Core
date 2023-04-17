import { properties, fClass, fData } from './fixtures/dao'
import { DataObject } from '../DataObject'
import { MockAdapter } from '../../backends/MockAdapter'
import { ObjectUri } from '../ObjectUri'

MockAdapter.inject(fData)

const params = { properties }

describe('Data object', () => {
   test('has properties that are instances', () =>
      DataObject.factory(params).then((dao) => {
         expect(dao.get('string').constructor.name).toBe('StringProperty')
         expect(dao.get('boolean').constructor.name).toBe('BooleanProperty')
         expect(dao.get('enum').constructor.name).toBe('EnumProperty')
         expect(dao.get('object').constructor.name).toBe('ObjectProperty')
      }))

   test('has a class name', () =>
      DataObject.factory(params).then((dao) => {
         expect(dao.class).toBeUndefined()
         dao.uri.class = fClass.prototype
         expect(dao.class).toBe(fClass.prototype)
      }))

   test('can set its uri from a string or an ObjectUri', () => {
      DataObject.factory({ uri: 'a/b', ...params }).then((dao) => {
         expect(dao.uri.constructor.name).toBe('ObjectUri')
         dao.uri = new ObjectUri('a/b')
         expect(dao.uri.constructor.name).toBe('ObjectUri')
      })
   })

   test('can provide default values of props', () => {
      DataObject.factory(params)
         .then((dao) => {
            expect(dao.val('string')).toEqual('nothing')
            expect(dao.val('boolean')).toEqual(false)
            expect(dao.val('enum')).toEqual(undefined)
            expect(dao.val('object')).toEqual(undefined)
         })
         .catch((e) => console.log(e))
   })

   test('can be populated with data', () => {
      DataObject.factory({ uri: 'a/b', ...params }).then((dao) => {
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

   test('can be cloned', () => {
      DataObject.factory(params).then((dao) => {
         dao.clone().then((clone) => {
            expect(clone.class).toBe(dao.class)
            expect(clone.properties.length).toBe(dao.properties.length)
            expect(clone.properties.string).toBeDefined()
            expect(clone.properties.boolean).toBeDefined()
            expect(clone.properties.enum).toBeDefined()
            expect(clone.properties.object).toBeDefined()
         })
      })
   })
})
