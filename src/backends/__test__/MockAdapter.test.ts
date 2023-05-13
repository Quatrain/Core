import { DataObject, ObjectUri } from '../../components'
import {
   fClass,
   fClassProperties,
} from '../../components/__test__/fixtures/dao'
import { Core } from '../../Core'
import { MockAdapter } from '../MockAdapter'

// inject() makes @mock default backend


Core.addBackend(new MockAdapter(), '@mock')
const backend = Core.getBackend('@mock')

const uri = new ObjectUri()
uri.class = fClass

describe('MockAdapter CRUD operations', () => {
   test('write data', async () => {
      // create a basic data object
      const dao = await DataObject.factory({
         properties: fClassProperties,
         uri,
      })

      // set an acceptable value to its property
      dao.set('a', 'a string')

      // Check that object is successfully created in backend
      backend.create(dao).then(() => {
         expect(dao.isPersisted()).toBe(true)
         expect(dao.uri).not.toBeUndefined()
         expect(dao.uid).not.toBeUndefined()
         expect(dao.uri?.constructor.name).toBe('ObjectUri')
         expect(dao.uid && MockAdapter.getFixture(dao.uid)).not.toBeUndefined()
         expect(dao.uid && MockAdapter.getFixture(dao.uid)).toContain('a')
      })
   })

   test('read data', async () => {
      MockAdapter.inject({ uid: 'a/b', path: 'a/b', a: 'b', c: 'd', e: 3 })

      const dao = await DataObject.factory({
         properties: fClassProperties,
         uri: 'a/b',
      })
      backend.read(dao).then(() => {
         expect(dao.val('a')).toBe('b')
      })
   })

   test('update data', async () => {
      const dao = await DataObject.factory({
         properties: fClassProperties,
         uri: 'a/b',
      })
      dao.set('a', 'a string')

      backend.read(dao).then(() => {
         dao.set('a', 'another string')
         backend.update(dao).then(() => {
            const fixture = dao.uid && MockAdapter.getFixture(dao.uid)
            expect(fixture.a).toEqual('another string')
         })
      })
   })

   test('delete data', async () => {
      const dao = await DataObject.factory({
         properties: fClassProperties,
         uri: 'a/b',
      })
      backend.delete(dao).then(() => {
         expect(dao.uid).toBeUndefined()
         expect(MockAdapter.getFixture('a/b')).toBeUndefined()
      })
   })
})
