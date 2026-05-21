import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Dashboard } from '../Dashboard'

jest.mock('@mantine/core', () => {
   const dummyComponent = (name: string) => {
      const Comp = ({ children }: any) => {
         return React.createElement('div', { 'data-component': name }, children)
      }
      Comp.displayName = name
      return Comp
   }
   return {
      Card: dummyComponent('Card'),
      Text: dummyComponent('Text'),
      Group: dummyComponent('Group'),
      SimpleGrid: dummyComponent('SimpleGrid'),
      Title: dummyComponent('Title'),
      ThemeIcon: dummyComponent('ThemeIcon'),
      Button: dummyComponent('Button')
   }
})

jest.mock('../i18nContext', () => {
   return {
      useI18n: () => ({
         t: (key: string, defaultValue?: string) => defaultValue || key
      })
   }
})

describe('Dashboard Component', () => {
   it('should render correct counts for models, backends, and widgets', () => {
      const mockModels = [{ id: '1' }, { id: '2' }]
      const mockBackends = [{ name: 'PostgreSQL' }]
      const mockWidgets = [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }]

      const html = renderToStaticMarkup(
         React.createElement(Dashboard, {
            models: mockModels,
            backends: mockBackends,
            widgets: mockWidgets
         })
      )

      // Assert that the numbers are rendered in the final static output
      expect(html).toContain('2') // Models count
      expect(html).toContain('PostgreSQL') // Active backend name
      expect(html).toContain('3') // Widgets count
   })

   it('should handle empty states gracefully', () => {
      const html = renderToStaticMarkup(
         React.createElement(Dashboard, {
            models: [],
            backends: [],
            widgets: []
         })
      )

      expect(html).toContain('0') // Models count
      expect(html).toContain('dashboard.noBackend') // Default key from mocked t
   })
})
