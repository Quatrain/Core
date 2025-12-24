import { StringProperty } from './StringProperty'

describe('String Property without digits', () => {
   const prop = new StringProperty({ name: 'toto', allowDigits: false })
   test('allow digits is not set', () =>
      expect(prop.allows).not.toContain(StringProperty.ALLOW_DIGITS))
   test('no digits allowed', () => expect(() => prop.set('va1ue')).toThrow())
})

describe('String Property without spaces', () => {
   const prop = new StringProperty({ name: 'toto', allowSpaces: false })
   test('allow spaces is not set', () =>
      expect(prop.allows).not.toContain(StringProperty.ALLOW_SPACES))
   test('no space allowed', () => expect(() => prop.set('va1 ue')).toThrow())
})

describe('String Property without letters', () => {
   const prop = new StringProperty({ name: 'toto', allowLetters: false })
   test('allow letters is not set', () =>
      expect(prop.allows).not.toContain(StringProperty.ALLOW_LETTERS))
   test('no letters allowed', () => expect(() => prop.set('value')).toThrow())
})

describe('String Property with minimal length', () => {
   const prop = new StringProperty({ name: 'toto', minLength: 6 })
   test('minlength is set', () => expect(prop.minLength).toBeGreaterThan(0))
   test('minimum length of 5', () => expect(() => prop.set('value')).toThrow())
})

describe('String Property with maximal length', () => {
   const prop = new StringProperty({ name: 'toto', maxLength: 4 })
   test('maxlength is set', () => expect(prop.maxLength).toBeGreaterThan(0))
   test('maximum length of 5', () => expect(() => prop.set('value')).toThrow())
})

describe('String Property provides transformers', () => {
   const prop = new StringProperty({ name: 'toto' })
   test('transform to upper case', () =>
      expect(prop.set('value').get(StringProperty.TRANSFORM_UCASE)).toBe(
         'VALUE'
      ))
   test('transform to lower case', () =>
      expect(prop.set('VALUE').get(StringProperty.TRANSFORM_LCASE)).toBe(
         'value'
      ))
})
