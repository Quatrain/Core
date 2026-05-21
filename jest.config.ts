export default {
   coverageProvider: 'v8',
   setupFiles: ['trace-unhandled/register'],
   transform: {
      '\\.(ts|tsx)$': 'ts-jest',
   },
   testMatch: ['**/?(*.)+(spec|test).ts'],
}
