import { Backend } from './Backend'
import { MockAdapter } from './MockAdapter'

describe('Backend Registry', () => {
   it('should register and retrieve a backend', () => {
      const adapter = new MockAdapter()
      Backend.addBackend(adapter, 'test-backend')
      expect(Backend.getBackend('test-backend')).toBe(adapter)
   })

   it('should set and retrieve the default backend', () => {
      const adapter = new MockAdapter()
      Backend.addBackend(adapter, 'default-backend', true)
      expect(Backend.getBackend()).toBe(adapter)
      expect(Backend.defaultBackend).toBe('default-backend')
   })

   it('should throw an error for unknown backend', () => {
      expect(() => Backend.getBackend('unknown')).toThrow(
         "Unknown backend alias: 'unknown'"
      )
   })
})
