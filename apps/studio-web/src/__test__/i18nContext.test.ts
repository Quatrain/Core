import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider, useI18n } from '../i18nContext'

// Set up mock localStorage for Node test environment
const mockLocalStorage: Record<string, string> = {}
global.localStorage = {
   getItem: jest.fn((key) => mockLocalStorage[key] || null),
   setItem: jest.fn((key, value) => { mockLocalStorage[key] = value }),
   removeItem: jest.fn((key) => { delete mockLocalStorage[key] }),
   clear: jest.fn(() => { for (const key in mockLocalStorage) delete mockLocalStorage[key] }),
   length: 0,
   key: jest.fn()
} as any

describe('I18nProvider & useI18n', () => {
   beforeEach(() => {
      jest.clearAllMocks()
      for (const key in mockLocalStorage) {
         delete mockLocalStorage[key]
      }
   })

   it('should provide translated text and active locale', () => {
      let capturedContext: any = null

      const CaptureComponent = () => {
         capturedContext = useI18n()
         return null
      }

      renderToStaticMarkup(
         React.createElement(I18nProvider, null, 
            React.createElement(CaptureComponent)
         )
      )

      expect(capturedContext).not.toBeNull()
      expect(capturedContext.locale).toBe('fr') // Default from I18nProvider state
      expect(capturedContext.t('app.dashboard')).not.toBe('app.dashboard')
   })

   it('should allow changing active locale and persist in localStorage', () => {
      let capturedContext: any = null

      const CaptureComponent = () => {
         capturedContext = useI18n()
         return null
      }

      renderToStaticMarkup(
         React.createElement(I18nProvider, null, 
            React.createElement(CaptureComponent)
         )
      )

      expect(capturedContext.locale).toBe('fr')
      
      // Change language
      capturedContext.changeLanguage('en')
      expect(localStorage.setItem).toHaveBeenCalledWith('coreStudioLang', 'en')
      
      // Wait for React to re-render is not needed because state is set synchronously 
      // when changeLanguage is called under mock, but let's test if local value is set
      expect(mockLocalStorage['coreStudioLang']).toBe('en')
   })

   it('should use default value when translation is missing', () => {
      let capturedContext: any = null

      const CaptureComponent = () => {
         capturedContext = useI18n()
         return null
      }

      renderToStaticMarkup(
         React.createElement(I18nProvider, null, 
            React.createElement(CaptureComponent)
         )
      )

      const result = capturedContext.t('missingkey', 'Fallback Default')
      expect(result).toBe('Fallback Default')
   })

   it('should throw an error when useI18n is used outside I18nProvider', () => {
      const ErrorComponent = () => {
         useI18n()
         return null
      }

      const originalError = console.error
      console.error = jest.fn() // Prevent React's boundary error logs from cluttering the output

      expect(() => {
         renderToStaticMarkup(React.createElement(ErrorComponent))
      }).toThrow('useI18n must be used within an I18nProvider')

      console.error = originalError
   })
})
