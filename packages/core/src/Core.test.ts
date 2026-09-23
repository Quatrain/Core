import { Core } from './Core'

describe('Core Legacy Config Methods (@deprecated)', () => {
   it('should persist and retrieve configuration values using Core.addConfig and Core.getConfig', async () => {
      const testKey = 'unit_test_key'
      const testValue = { enabled: true, endpoint: 'https://api.example.com' }

      await Core.addConfig(testKey, testValue)
      const retrieved = await Core.getConfig(testKey)

      expect(retrieved).toEqual(testValue)
   })

   it('should return undefined when retrieving a non-existent key', async () => {
      const missing = await Core.getConfig('non_existent_key_12345')
      expect(missing).toBeUndefined()
   })
})
