export type CardThemeMode = 'pwa' | 'tv' | 'web'

export type CardDataSourceType = 'plot' | 'probe' | 'sensor'

export type CardStatusLevel = 'optimal' | 'warning' | 'alert' | 'info' | 'neutral'

export interface CardInterpretation {
   label: string
   status: CardStatusLevel
   badgeColor?: string
   description?: string
}

export interface CardExtremes {
   max?: number
   min?: number
   unit?: string
   maxLabel?: string
   minLabel?: string
}

export interface CardSubMetric {
   id: string
   label: string
   value: number | string
   unit?: string
   trend?: 'up' | 'down' | 'stable'
   status?: CardStatusLevel
}

export interface SquareCardConfig {
   id: string
   title: string
   subtitle?: string
   sourceType?: CardDataSourceType
   sourceName?: string
   icon?: string
   primaryValue: number | string
   unit?: string
   extremes?: CardExtremes
   interpretation?: CardInterpretation
   subMetrics?: CardSubMetric[] // Used for stacked card horizon layers
   timestamp?: number | string
   relativeTime?: string
   themeMode?: CardThemeMode
   isStacked?: boolean
   isInteractive?: boolean
   onClickUrl?: string
}
