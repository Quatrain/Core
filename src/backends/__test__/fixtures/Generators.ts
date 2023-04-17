import { MockAdapter } from '../../MockAdapter'
import { faker } from '@faker-js/faker'

export const UserDataGenerator = (qty: number) => {
   for (let i = 0; i < qty; i++) {
      MockAdapter.inject({
         uid: `users/${String(i).padStart(4, '0')}`,
         firstname: faker.name.firstName(),
         lastname: faker.name.lastName(),
         email: faker.internet.email(),
         password: faker.random.alphaNumeric(8),
      })
   }
}
