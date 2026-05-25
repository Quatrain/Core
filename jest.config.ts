export default {
   coverageProvider: 'v8',
   setupFiles: ['trace-unhandled/register'],
   transform: {
      '\\.(ts|tsx)$': ['ts-jest', {
         tsconfig: {
            module: 'CommonJS',
            jsx: 'react-jsx'
         }
      }],
   },
   testMatch: ['**/?(*.)+(spec|test).ts'],
}


