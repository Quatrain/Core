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
   collectCoverageFrom: [
      'packages/*/src/**/*.{ts,tsx}',
      'apps/*/src/**/*.{ts,tsx}',
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/*.migration.ts',
      '!**/*.d.ts'
   ]
}

