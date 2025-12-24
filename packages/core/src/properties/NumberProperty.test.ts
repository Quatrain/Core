import { NumberProperty } from './NumberProperty'

describe('Number Property accept all numbers', () => {
   const prop = new NumberProperty({ name: 'toto' })
   test('allow positive number', () => expect(prop.set(10).val()).toBe(10))
   test('allow zero number', () => expect(prop.set(0).val()).toBe(0))
   test('allow negative number', () => expect(prop.set(-10).val()).toBe(-10))
})

describe('Number Property can restrict signed numbers', () => {
   const prop = new NumberProperty({
      name: 'toto',
      sign: NumberProperty.TYPE_UNSIGNED,
   })
   test('only allow positive or zero number', () =>
      expect(() => prop.set(-1)).toThrow())
})

describe('Number Property can display prefix or/and suffix', () => {
   test('display prefix', () =>
      expect(
         new NumberProperty({
            name: 'toto',
            prefix: 'EUR',
         })
            .set(123)
            .val(NumberProperty.TRANSFORM_FORMATTED)
      ).toBe('EUR 123'))
   test('display suffix', () =>
      expect(
         new NumberProperty({
            name: 'toto',
            suffix: '€',
         })
            .set(123)
            .val(NumberProperty.TRANSFORM_FORMATTED)
      ).toBe('123 €'))
})
