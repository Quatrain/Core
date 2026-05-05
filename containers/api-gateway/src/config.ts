import { Api } from '@quatrain/api'

export const PORT = process.env.PORT || 3000
export const API_UPSTREAM_URL = process.env.API_UPSTREAM_URL

if (!API_UPSTREAM_URL) {
  Api.error('CRITICAL: API_UPSTREAM_URL environment variable is missing.')
  process.exit(1)
}

export const MAX_CACHE_SIZE_MB = parseInt(process.env.MAX_CACHE_SIZE_MB || '5', 10)
