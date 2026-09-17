import React from 'react'

/**
 * CoreStatusBadge
 * Complies with Quatrain CoreUX Contrast & Status Tokens specification:
 * - Optimal (Level 1): Vivid green (#22c55e) with white text.
 * - Nominal (Level 2): Bright yellow (#facc15) with STRICT dark navy text (#0f172a).
 * - Warning (Level 3): Saturated orange (#f97316) with white text.
 * - Danger  (Level 4): Saturated red (#ef4444) with white text.
 * - Brand   (Default): Sky/Cyan badge.
 */
export function CoreStatusBadge({ level = 'brand', children, className = '' }) {
  let badgeStyle = 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'

  switch (level) {
    case 'optimal':
    case 'success':
      badgeStyle = 'bg-emerald-500 text-white border-emerald-600'
      break
    case 'nominal':
    case 'yellow':
      // CRITICAL CoreUX Safeguard: Never use white text on yellow!
      badgeStyle = 'bg-yellow-400 text-slate-900 font-bold border-yellow-500'
      break
    case 'warning':
    case 'orange':
      badgeStyle = 'bg-orange-500 text-white border-orange-600'
      break
    case 'danger':
    case 'critical':
      badgeStyle = 'bg-rose-500 text-white border-rose-600'
      break
    case 'brand':
    default:
      badgeStyle = 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
      break
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border uppercase ${badgeStyle} ${className}`}>
      {children}
    </span>
  )
}
