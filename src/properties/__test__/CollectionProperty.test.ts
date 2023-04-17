import { User } from '../../components'
import { CollectionProperty } from '../CollectionProperty'
import { UserDataGenerator } from '../../backends/__test__/fixtures/Generators'

UserDataGenerator(5)

describe('Default Collection Property', () => {
   const prop = new CollectionProperty({ name: 'toto', instanceOf: User })
   prop.get().then((value) => console.log(value))
})
