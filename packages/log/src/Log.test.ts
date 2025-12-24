import { Log } from './Log'
import { DefaultLoggerAdapter } from './DefaultLoggerAdapter'

jest.mock('./DefaultLoggerAdapter')

describe('Log Class (Static Registry)', () => {
   beforeEach(() => {
      jest.clearAllMocks()
      // Reset the internal registry for clean tests
      // @ts-ignore - accessing protected member for testing
      Log._loggers = {}
   })

   it('should lazily initialize the @default logger on first access', () => {
      // Ensure registry is empty
      // @ts-ignore
      expect(Log._loggers['@default']).toBeUndefined()

      const logger = Log.getLogger('@default')

      expect(logger).toBeInstanceOf(DefaultLoggerAdapter)
      expect(DefaultLoggerAdapter).toHaveBeenCalled()
   })

   it('should correctly proxy multiple arguments to the underlying adapter', () => {
      const logger = Log.getLogger('@default')
      const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {})

      Log.info('arg1', 'arg2', { data: 123 })

      expect(infoSpy).toHaveBeenCalledWith('arg1', 'arg2', { data: 123 })
   })

   it('should allow adding a custom logger and setting it as default', () => {
      const customLogger = new DefaultLoggerAdapter('CUSTOM')
      Log.addLogger('custom', customLogger, true)

      expect(Log.defaultLogger).toBe('custom')
      expect(Log.getLogger()).toBe(customLogger)
   })

   it('should throw an error when requesting an unknown logger alias', () => {
      expect(() => Log.getLogger('ghost-logger')).toThrow(/Unknown logger alias/)
   })
})
