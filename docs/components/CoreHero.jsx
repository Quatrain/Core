import React from 'react'
import Link from 'next/link'
import { CoreStatusBadge } from './CoreStatusBadge'

/**
 * CoreHero
 * The flagship landmark component designed with CoreUX standards:
 * - Geometric Space Grotesk headline.
 * - Saturated brand gradients.
 * - Key framework metrics.
 */
export function CoreHero() {
  return (
    <div className="relative overflow-hidden pt-8 pb-12">
      {/* Background ambient lighting */}
      <div className="absolute top-0 -left-1/4 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-0 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-start gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <CoreStatusBadge level="optimal">
            Framework v1.3 Production
          </CoreStatusBadge>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Open Knowledge Architecture (OKF v0.1)
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-heading text-slate-900 dark:text-white leading-[1.1]">
          Quatrain{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500">
            Core
          </span>
        </h1>

        <p className="text-xl sm:text-2xl font-semibold text-slate-800 dark:text-slate-200 font-heading">
          A Modular, Sovereign & Universal TypeScript Backend Framework
        </p>

        <p className="text-base sm:text-lg italic text-slate-500 dark:text-slate-400 font-medium">
          "Business Logic outlives Infrastructure"
        </p>

        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          An enterprise-grade, modular TypeScript framework designed to build resilient, cloud-agnostic applications. Built around the Adapter Pattern, it completely decouples domain modeling and business rules from the underlying infrastructure.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3.5 pt-3">
          <Link
            href="/okf"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/35 transition-all duration-200"
          >
            <span>📖 Explore OKF Knowledge Base</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>

          <Link
            href="/packages"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-slate-800 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-all duration-200"
          >
            <span>📦 Browse 71 Packages</span>
          </Link>

          <a
            href="/core/api-reference/modules.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl font-semibold text-sm text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-all duration-200"
          >
            <span>⚡ API Reference ↗</span>
          </a>
        </div>

        {/* Framework Stat Metrics Bar */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800/80">
          <div>
            <div className="text-2xl sm:text-3xl font-black font-heading text-slate-900 dark:text-white">
              71
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
              Modular Packages
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-heading text-sky-600 dark:text-sky-400">
              7
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
              Architectural Layers
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-heading text-indigo-600 dark:text-indigo-400">
              100%
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
              Sovereign & Portable
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-heading text-emerald-600 dark:text-emerald-400">
              AGPL-3.0
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
              Open Source
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
