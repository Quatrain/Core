import { $model, Model, Type } from '../$model'
import { Core, statuses } from '../..'
import { MockAdapter } from '../../backends'

const BASE_PROPS = {
   name: { type: Type.STRING, mandatory: true },
   status: {
      type: Type.ENUM,
      mandatory: true,
      values: [
         statuses.CREATED,
         statuses.PENDING,
         statuses.ACTIVE,
         statuses.DELETED,
      ],
      defaultValue: statuses.CREATED,
   },
   createdBy: { type: Type.OBJECT },
   createdAt: { type: Type.DATETIME },
}

const BaseObject = $model('base', BASE_PROPS)
type BaseObject = Model<typeof BASE_PROPS>

Core.addBackend(new MockAdapter(), '@mock', true)

// MockAdapter.inject(BaseObjectData)
// MockAdapter.inject(UserData)

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

// describe('User object', () => {
//    test('can be loaded from backend', () => {
//       UserCore.factory(UserUri).then((user: User) => {
//          expect(user.name).toEqual('John Doe')
//          expect(user.status).toEqual(statuses.ACTIVE)
//          //expect(user.createdBy).toEqual(user.toJSON())
//          expect(user.createdAt).toEqual(1)
//       })
//    })

//    test('can be persisted in backend', () => {
//       UserCore.factory(UserUri)
//          .then((existingUser: User) => {
//             Core.currentUser = existingUser
//             UserCore.factory()
//                .then((user) => {
//                   expect((user as Persisted<User>).uid).toBeUndefined()
//                   user.name = 'Jane Doe'
//                   user.core.save().then(() => {
//                      expect('uid' in user).toBeTruthy()
//                      expect(user.name).toEqual('Jane Doe')
//                      expect(user.status).toEqual(statuses.CREATED)
//                   })
//                })
//                .catch((e) => console.log(e))
//          })
//          .catch((e) => console.log(e))
//          .catch((e) => console.log(e))
//    })
// })
