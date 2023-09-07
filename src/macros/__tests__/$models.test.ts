import { $model } from '../$model'
import { BaseObject, Core, Property, statuses } from '../..'
import { MockAdapter } from '../../backends'
import { Persisted } from '../../components/types/Persisted'
import {
   BaseObjectData,
   UserData,
   UserUri,
} from '../../components/__test__/fixtures/dao'

const BASE_PROPS = [
   { name: 'name', type: Property.TYPE_STRING, mandatory: true },
   {
      name: 'status',
      type: Property.TYPE_ENUM,
      mandatory: true,
      values: [
         statuses.CREATED,
         statuses.PENDING,
         statuses.ACTIVE,
         statuses.DELETED,
      ],
      defaultValue: statuses.CREATED,
   },
   { name: 'createdBy', type: Property.TYPE_OBJECT },
   { name: 'createdAt', type: Property.TYPE_DATETIME },
]

const BaseObject = $model('base', BASE_PROPS)
//type BaseObject = Model<typeof BASE_PROPS>

const USER_PROPS = [
   { name: 'username', type: Property.TYPE_STRING, mandatory: true },
]

const User = $model('users', [...BASE_PROPS, ...USER_PROPS])
//type User = Model<typeof BASE_PROPS & typeof USER_PROPS>

Core.addBackend(new MockAdapter(), '@mock', true)

MockAdapter.inject(BaseObjectData)
MockAdapter.inject(UserData)

describe('Base object', () => {
   test('has name, status and createdBy properties that are instances', () => {
      const obj = BaseObject.fromObject({
         name: 'Obj',
         status: statuses.ACTIVE,
         createdAt: undefined,
         createdBy: undefined,
      })

      expect(obj.core.dataObject.get('name').constructor.name).toBe(
         'StringProperty'
      )
      expect(obj.core.dataObject.get('status').constructor.name).toBe(
         'EnumProperty'
      )
      expect(obj.core.dataObject.get('createdBy').constructor.name).toBe(
         'ObjectProperty'
      )
      expect(obj.core.dataObject.get('createdAt').constructor.name).toBe(
         'DateTimeProperty'
      )
   })
})

describe('User object', () => {
   test('can be loaded from backend', () => {
      User.fromBackend(UserUri).then((user: any) => {
         expect(user.name).toEqual('John Doe')
         expect(user.status).toEqual(statuses.ACTIVE)
         //expect(user.createdBy).toEqual(user.toJSON())
         expect(user.createdAt).toEqual(1)
      })
   })

   test('can be persisted in backend', () => {
      User.factory(UserUri)
         .then((existingUser) => {
            User.factory()
               .then((user) => {
                  expect((user as any).uid).toBeUndefined()
                  user.name = 'Jane Doe'
                  user.core.save().then(() => {
                     expect('uid' in user).toBeTruthy()
                     expect(user.name).toEqual('Jane Doe')
                     expect(user.status).toEqual(statuses.CREATED)
                  })
               })
               .catch((e) => console.log(e))
         })
         .catch((e) => console.log(e))
         .catch((e) => console.log(e))
   })
})
