export default {
   coverageProvider: 'v8',
   setupFiles: ['trace-unhandled/register'],
   transform: {
      '\\.(ts)$': 'ts-jest',
   },
   testMatch: ['**/?(*.)+(spec|test).ts'],
}
