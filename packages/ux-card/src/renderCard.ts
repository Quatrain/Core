import { SquareCardConfig } from './types'

function escapeHtml(str?: string): string {
   if (!str) return ''
   return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
}

/**
 * Renders a square card HTML string based on the given configuration.
 */
export function renderSquareCardHtml(config: SquareCardConfig): string {
   const themeClass = config.themeMode ? `q-theme-${config.themeMode}` : ''
   const interactiveAttr = config.onClickUrl ? `data-href="${escapeHtml(config.onClickUrl)}" tabindex="0"` : ''

   // Zone 1 & 2: Header (Title, Source & Visual Badge)
   const sourceHtml = config.sourceName
      ? `<span class="q-card-source">${escapeHtml(config.sourceName)}</span>`
      : ''
   const iconHtml = config.icon ? `<div class="q-card-icon-badge">${config.icon}</div>` : ''

   // Zone 3: Left Column Extremes (or Stacked horizons)
   let extremesHtml = ''
   if (config.extremes && (config.extremes.max !== undefined || config.extremes.min !== undefined)) {
      const maxText =
         config.extremes.max !== undefined
            ? `▲ ${config.extremes.max}${config.extremes.unit ?? config.unit ?? ''}`
            : ''
      const minText =
         config.extremes.min !== undefined
            ? `▼ ${config.extremes.min}${config.extremes.unit ?? config.unit ?? ''}`
            : ''

      extremesHtml = `
      <div class="q-card-extremes">
        ${maxText ? `<span class="q-card-extreme-item q-card-extreme-max">${escapeHtml(maxText)}</span>` : ''}
        ${minText ? `<span class="q-card-extreme-item q-card-extreme-min">${escapeHtml(minText)}</span>` : ''}
      </div>`
   }

   // Stacked Submetrics list (e.g. soil horizons)
   let stackedListHtml = ''
   if (config.isStacked && config.subMetrics && config.subMetrics.length > 0) {
      stackedListHtml = `
      <div class="q-card-stacked-list">
        ${config.subMetrics
           .map(
              (m) => `
          <div class="q-card-stacked-item">
            <span class="q-card-stacked-label">${escapeHtml(m.label)}</span>
            <strong class="q-card-stacked-val">${escapeHtml(String(m.value))} ${escapeHtml(m.unit ?? '')}</strong>
          </div>
        `,
           )
           .join('')}
      </div>`
   }

   // Zone 4: Core Primary Metric Value
   const primaryMetricHtml = `
    <div class="q-card-main-metric">
      <span class="q-card-value">${escapeHtml(String(config.primaryValue))}</span>
      ${config.unit ? `<span class="q-card-unit">${escapeHtml(config.unit)}</span>` : ''}
    </div>`

   // Zone 5 & 6: Footer (Freshness Time & Status Badge)
   const timeHtml = config.relativeTime
      ? `<span class="q-card-time">${escapeHtml(config.relativeTime)}</span>`
      : ''
   const badgeHtml = config.interpretation
      ? `<span class="q-card-badge q-card-badge-${config.interpretation.status}" ${config.interpretation.badgeColor ? `style="background-color: ${escapeHtml(config.interpretation.badgeColor)}"` : ''}>${escapeHtml(config.interpretation.label)}</span>`
      : ''

   return `
<article class="q-square-card ${themeClass}" id="card-${escapeHtml(config.id)}" ${interactiveAttr}>
  <header class="q-card-header">
    <div class="q-card-title-group">
      <span class="q-card-title">${escapeHtml(config.title)}</span>
      ${sourceHtml}
    </div>
    ${iconHtml}
  </header>

  <div class="q-card-body">
    ${stackedListHtml ? stackedListHtml : `${extremesHtml}${primaryMetricHtml}`}
  </div>

  <footer class="q-card-footer">
    ${timeHtml}
    ${badgeHtml}
  </footer>
</article>`
}
