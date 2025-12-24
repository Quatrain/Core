import { BaseProperty } from './BaseProperty'

describe('BaseProperty', () => {
   it('should initialize with name and default values', () => {
      const prop = new BaseProperty({ name: 'TestProp' })
      expect(prop.name).toBe('TestProp')
      expect(prop.val()).toBeUndefined()
      expect(prop.hasChanged).toBe(false)
   })

   it('should handle functional default values', () => {
      const prop = new BaseProperty({
         name: 'test',
         defaultValue: () => 'dynamic-default',
      })
      expect(prop.val()).toBe('dynamic-default')
   })

   it('should set and get values correctly', () => {
      const prop = new BaseProperty({ name: 'test' })
      prop.set('new-value')
      expect(prop.val()).toBe('new-value')
      expect(prop.hasChanged).toBe(true)
   })

   it('should respect the protected attribute (write-once logic)', () => {
      const prop = new BaseProperty({
         name: 'test',
         protected: true,
         defaultValue: 'initial',
      })

      // First change is allowed if it moves away from default
      prop.set('first-change')
      expect(prop.val()).toBe('first-change')

      // Subsequent changes should throw
      expect(() => prop.set('second-change')).toThrow(/protected from change/)
   })

   it('should trigger onChange event when value changes', () => {
      const onChange = jest.fn()
      const prop = new BaseProperty({ name: 'test', onChange })

      prop.set('updated')
      expect(onChange).toHaveBeenCalled()
   })

   it('should transform values using the val() method', () => {
      const prop = new BaseProperty({ name: 'test' })
      prop.set(10)
      const doubled = prop.val((v: number) => v * 2)
      expect(doubled).toBe(20)
   })

   it('should clone the property correctly', () => {
      const prop = new BaseProperty({ name: 'test' })
      prop.set('original')
      const cloned = prop.clone()

      expect(cloned.name).toBe(prop.name)
      expect(cloned.val()).toBe(prop.val())
      expect(cloned).not.toBe(prop)
   })

   it('should return falsy values (0, false, "") correctly from val()', () => {
      const propNum = new BaseProperty({ name: 'num', defaultValue: 10 })
      propNum.set(0)
      expect(propNum.val()).toBe(0)

      const propBool = new BaseProperty({ name: 'bool', defaultValue: true })
      propBool.set(false)
      expect(propBool.val()).toBe(false)

      const propStr = new BaseProperty({ name: 'str', defaultValue: 'default' })
      propStr.set('')
      expect(propStr.val()).toBe('')
   })
})
