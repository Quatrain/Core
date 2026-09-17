import React from 'react'
import Link from 'next/link'
import { CoreStatusBadge } from './CoreStatusBadge'

/**
 * CoreFeatureCard
 * Follows CoreUX principles:
 * - Dual-Typeface (Space Grotesk title + Inter description).
 * - Static CSS Hygiene (100% Tailwind class bindings, zero dynamic inline styles).
 * - CSS-driven hover micro-interactions via compositor thread.
 * - Contrast token badges.
 */
export function CoreFeatureCard({
  title,
  description,
  href,
  icon,
  badge,
  badgeLevel = 'brand',
  layer,
  className = ''
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-between p-6 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 hover:border-primary-500/60 dark:hover:border-primary-500/50 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300 overflow-hidden ${className}`}
    >
      {/* Subtle top accent gradient line on hover */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-transparent to-transparent group-hover:via-primary-500 transition-all duration-500" />

      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-2xl border border-slate-200/60 dark:border-slate-700/60 group-hover:scale-110 transition-transform duration-300">
                {icon}
              </span>
            )}
            {layer && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {layer}
              </span>
            )}
          </div>
          {badge && (
            <CoreStatusBadge level={badgeLevel}>
              {badge}
            </CoreStatusBadge>
          )}
        </div>

        <h3 className="text-xl font-bold font-heading text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-200 mb-2">
          {title}
        </h3>

        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold text-primary-600 dark:text-sky-400">
        <span>En savoir plus</span>
        <svg
          className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform duration-200"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
