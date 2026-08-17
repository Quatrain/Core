import { describe, expect, test } from 'bun:test'
import { renderSquareCardHtml } from './renderCard'
import { SquareCardConfig } from './types'

describe('SquareCard Renderer', () => {
   test('renders a basic temperature card with extremes and status badge', () => {
      const config: SquareCardConfig = {
         id: 'temp-1',
         title: 'Air : Température',
         sourceName: 'Parcelle Les Vignes',
         icon: '☀️',
         primaryValue: '24.5',
         unit: '°C',
         extremes: {
            max: 28.2,
            min: 14.1,
            unit: '°',
         },
         interpretation: {
            label: 'Idéal',
            status: 'optimal',
         },
         relativeTime: 'Il y a 5 min',
         themeMode: 'pwa',
      }

      const html = renderSquareCardHtml(config)
      expect(html).toContain('Air : Température')
      expect(html).toContain('Parcelle Les Vignes')
      expect(html).toContain('24.5')
      expect(html).toContain('°C')
      expect(html).toContain('▲ 28.2°')
      expect(html).toContain('▼ 14.1°')
      expect(html).toContain('Idéal')
      expect(html).toContain('q-theme-pwa')
   })

   test('renders a stacked card with sub-metrics for soil horizons', () => {
      const config: SquareCardConfig = {
         id: 'soil-stacked',
         title: 'Sol : Humidité',
         sourceName: 'Sonde b26s005',
         icon: '💧',
         primaryValue: '42.1',
         unit: '%',
         isStacked: true,
         subMetrics: [
            { id: '10cm', label: '10cm', value: 58, unit: '%' },
            { id: '30cm', label: '30cm', value: 42, unit: '%' },
            { id: '60cm', label: '60cm', value: 35, unit: '%' },
         ],
         interpretation: {
            label: 'Confort',
            status: 'optimal',
         },
         themeMode: 'tv',
      }

      const html = renderSquareCardHtml(config)
      expect(html).toContain('Sol : Humidité')
      expect(html).toContain('10cm')
      expect(html).toContain('58 %')
      expect(html).toContain('60cm')
      expect(html).toContain('q-theme-tv')
   })
})
