export default {
   coverageProvider: 'v8',
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
