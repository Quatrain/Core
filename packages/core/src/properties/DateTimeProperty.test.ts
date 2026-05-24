import { DateTimeProperty } from './DateTimeProperty'

describe('DateTimeProperty', () => {
   afterEach(() => {
      // Restore default global setting after each test
      DateTimeProperty.RETURN_AS = DateTimeProperty.AS_IS
   })

   describe('timezone configuration', () => {
      it('should default to "Z" timezone if none is provided', () => {
         const prop = new DateTimeProperty({ name: 'testDate' })
         expect(prop.timezone).toBe('Z')
      })

      it('should accept and return a custom timezone string', () => {
         const prop = new DateTimeProperty({ name: 'testDate', timezone: 'Europe/Paris' })
         expect(prop.timezone).toBe('Europe/Paris')
      })
   })

   describe('value setting with default RETURN_AS = asis', () => {
      it('should set and get values unmodified', () => {
         const prop = new DateTimeProperty({ name: 'testDate' })
         const date = new Date()

         prop.set(date)
         expect(prop.val()).toBe(date)

         prop.set('2026-05-24T09:00:00Z')
         expect(prop.val()).toBe('2026-05-24T09:00:00Z')

         prop.set(1716537600000)
         expect(prop.val()).toBe(1716537600000)
      })
   })

   describe('value setting with RETURN_AS = unix_timestamp', () => {
      beforeEach(() => {
         DateTimeProperty.RETURN_AS = DateTimeProperty.UNIX_TIMESTAMP
      })

      it('should convert JS Date objects to UNIX timestamp milliseconds', () => {
         const prop = new DateTimeProperty({ name: 'testDate' })
         const date = new Date('2026-05-24T12:00:00.000Z')

         prop.set(date)
         expect(prop.val()).toBe(date.getTime())
      })

      it('should parse ISO strings with trailing Z as UTC timestamps', () => {
         const prop = new DateTimeProperty({ name: 'testDate' })
         prop.set('2026-05-24T12:00:00.000Z')

         const expectedTime = Date.parse('2026-05-24T12:00:00.000Z')
         expect(prop.val()).toBe(expectedTime)
      })

      it('should parse ISO strings with timezone offsets correctly', () => {
         const prop = new DateTimeProperty({ name: 'testDate' })
         prop.set('2026-05-24T12:00:00+02:00')

         const expectedTime = Date.parse('2026-05-24T12:00:00+02:00')
         expect(prop.val()).toBe(expectedTime)
      })

      it('should treat plain date strings without timezone as UTC by appending T and Z', () => {
         const prop = new DateTimeProperty({ name: 'testDate' })
         
         // Non-ISO string with space, no offset
         prop.set('2026-05-24 12:00:00')

         const expectedTime = Date.parse('2026-05-24T12:00:00Z')
         expect(prop.val()).toBe(expectedTime)
      })

      it('should pass numeric timestamps directly', () => {
         const prop = new DateTimeProperty({ name: 'testDate' })
         const timestamp = 1716552000000

         prop.set(timestamp)
         expect(prop.val()).toBe(timestamp)
      })

      it('should handle falsy/empty values gracefully without throw', () => {
         const prop = new DateTimeProperty({ name: 'testDate' })
         
         prop.set('')
         expect(prop.val()).toBe('')
      })
   })
})
