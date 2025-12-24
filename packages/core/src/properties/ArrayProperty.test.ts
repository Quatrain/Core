import { ArrayProperty } from './ArrayProperty'
import { StringProperty } from './StringProperty'

const arrayValue = ['ab', 'cd', 'ef']
const transformer = (array: Array<string>) => array.join()

describe('Array Property without digits', () => {
   const prop = new ArrayProperty({ name: 'toto', allowNumbers: false })
   test('allow numbers is not set', () =>
      expect(prop.allows).not.toContain(StringProperty.ALLOW_NUMBERS))
   test('no numbers allowed', () => expect(() => prop.set([123])).toThrow())
})

describe('Array Property without strings', () => {
   const prop = new ArrayProperty({ name: 'toto', allowStrings: false })
   test('allow strings is not set', () =>
      expect(prop.allows).not.toContain(StringProperty.ALLOW_STRINGS))
   test('no strings allowed', () => expect(() => prop.set(['value'])).toThrow())
})

describe('Array Property with minimal length', () => {
   const prop = new ArrayProperty({ name: 'toto', minLength: 3 })
   test('minlength is set', () => expect(prop.minLength).toBeGreaterThan(0))
   test('minimum length of 3', () =>
      expect(() => prop.set(['value', 123])).toThrow())
})

describe('Array Property with maximal length', () => {
   const prop = new ArrayProperty({ name: 'toto', maxLength: 2 })
   test('maxlength is set', () => expect(prop.maxLength).toBeGreaterThan(0))
   test('maximum length of 2', () =>
      expect(() => prop.set(['value', 123, 'blue'])).toThrow())
})

describe('Array Property returns array', () => {
   const prop = new ArrayProperty({ name: 'toto' })
   test('transform array to string', () =>
      expect(prop.set(arrayValue).get()).toBe(arrayValue))
})

// describe('Array Property supports registered transformer', () => {
//    const prop = new ArrayProperty({ name: 'toto' })
//    //prop.addTransformer(transformer)
//    test('transform array to string', () =>
//       expect(prop.set(arrayValue).get()).toBe('abcdef'))
// })
