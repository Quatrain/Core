import React from 'react'

export default {
  logo: (
    <span className="flex items-center gap-2.5 font-bold tracking-tight text-slate-900 dark:text-white">
      <svg className="w-6 h-6 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
      <span className="text-base font-extrabold font-heading">Quatrain Core</span>
      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary-100 text-primary-800 dark:bg-primary-950/80 dark:text-sky-300 dark:border dark:border-sky-800/60 ml-1">
        v1.3
      </span>
    </span>
  ),
  project: {
    link: 'https://github.com/Quatrain/Core'
  },
  chat: {
    link: 'https://quatrain.community'
  },
  banner: {
    key: 'quatrain-community-banner',
    text: (
      <a href="https://quatrain.community" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium">
        <span>🌐 <strong>Quatrain Community</strong>: Uniting open-source initiatives — Join quatrain.community ↗</span>
      </a>
    )
  },
  search: {
    placeholder: 'Search architecture, packages, API...'
  },
  docsRepositoryBase: 'https://github.com/Quatrain/Core/tree/main/docs',
  gitTimestamp: false,
  editLink: {
    component: null
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  primaryHue: 199,
  primarySaturation: 89,
  footer: {
    text: (
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 py-4 text-xs text-slate-500 dark:text-slate-400">
        <div>
          © {new Date().getFullYear()} <strong className="text-slate-700 dark:text-slate-200">Quatrain Technologies</strong>. AGPL-3.0 Open Source License.
        </div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/Quatrain/Core" target="_blank" rel="noreferrer" className="hover:text-primary-500 transition-colors">GitHub</a>
          <a href="https://quatrain.community" target="_blank" rel="noreferrer" className="hover:text-primary-500 transition-colors">Community</a>
          <a href="/core/api-reference/modules.html" className="hover:text-primary-500 transition-colors">TypeDoc</a>
        </div>
      </div>
    )
  }
}
