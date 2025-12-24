import { DefaultLoggerAdapter } from './DefaultLoggerAdapter'
import { LogLevel } from './AbstractLoggerAdapter'
import logger from 'loglevel'
import chalk from 'chalk'

jest.mock('loglevel', () => ({
   setLevel: jest.fn(),
   trace: jest.fn(),
   debug: jest.fn(),
   info: jest.fn(),
   warn: jest.fn(),
   error: jest.fn(),
   log: jest.fn(),
}))

jest.mock('chalk', () => ({
   grey: jest.fn((s) => s),
   yellow: jest.fn((s) => s),
   green: jest.fn((s) => s),
   red: jest.fn((s) => s),
   bgRedBright: jest.fn((s) => s),
}))

describe('DefaultLoggerAdapter', () => {
   let adapter: DefaultLoggerAdapter

   beforeEach(() => {
      jest.clearAllMocks()
      // Use Jest to mock the global Date
      jest.useFakeTimers().setSystemTime(new Date('2023-01-01T00:00:00.000Z'))
      adapter = new DefaultLoggerAdapter('TEST', LogLevel.DEBUG)
   })

   afterEach(() => {
      jest.useRealTimers()
   })

   it('should initialize and set the log level', () => {
      expect(logger.setLevel).toHaveBeenCalledWith(LogLevel.DEBUG)
   })

   it('should log debug messages with yellow color', () => {
      adapter.debug('debug message')
      expect(logger.debug).toHaveBeenCalledWith(
         '2023-01-01T00:00:00.000Z - [TEST] debug message'
      )
      expect(chalk.yellow).toHaveBeenCalled()
   })

   it('should log info messages with green color', () => {
      adapter.info('info message')
      expect(logger.info).toHaveBeenCalledWith(
         '2023-01-01T00:00:00.000Z - [TEST] info message'
      )
      expect(chalk.green).toHaveBeenCalled()
   })

   it('should log multiple arguments correctly', () => {
      adapter.info('msg1', 'msg2', { key: 'val' })
      expect(logger.info).toHaveBeenCalledWith(
         expect.stringContaining('msg1 msg2 {"key":"val"}')
      )
   })

   it('should format Error objects correctly', () => {
      const error = new Error('test error')
      adapter.error(error)
      expect(logger.error).toHaveBeenCalledWith(
         expect.stringContaining('test error')
      )
   })

   it('should not mutate the input messages array', () => {
      const input = ['original message']
      adapter.info(input)
      expect(input).toHaveLength(1)
      expect(input[0]).toBe('original message')
   })

   it('should log warn messages with red color', () => {
      adapter.warn('warn message')
      expect(logger.warn).toHaveBeenCalledWith(
         '2023-01-01T00:00:00.000Z - [TEST] warn message'
      )
      expect(chalk.red).toHaveBeenCalled()
   })

   it('should log error messages with bgRedBright color', () => {
      adapter.error('error message')
      expect(logger.error).toHaveBeenCalledWith(
         '2023-01-01T00:00:00.000Z - [TEST] error message'
      )
      expect(chalk.bgRedBright).toHaveBeenCalled()
   })

   it('should log trace messages with grey color', () => {
      adapter.trace('trace message')
      expect(logger.trace).toHaveBeenCalledWith(
         '2023-01-01T00:00:00.000Z - [TEST] trace message'
      )
      expect(chalk.grey).toHaveBeenCalled()
   })
})
