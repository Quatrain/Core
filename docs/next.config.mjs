import nextra from 'nextra'

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx'
})

const basePath = process.env.BASE_PATH !== undefined ? process.env.BASE_PATH : '/core'

export default withNextra({
  basePath,
  output: 'export',
  images: {
    unoptimized: true
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  experimental: {
    // Limit memory usage by restricting Next.js to 1 worker CPU thread
    cpus: 1,
    // Disable worker threads to reduce memory overhead
    workerThreads: false
  }
})
