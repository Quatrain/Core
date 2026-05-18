import { Api } from '@quatrain/api'

export const PORT = process.env.PORT || 3000
export const API_UPSTREAM_URL = process.env.API_UPSTREAM_URL

if (!API_UPSTREAM_URL) {
  Api.error('CRITICAL: API_UPSTREAM_URL environment variable is missing.')
  process.exit(1)
}

export const MAX_CACHE_SIZE_MB = Number.parseInt(process.env.MAX_CACHE_SIZE_MB || '5', 10)
export const GATEWAY_MAXSIZE = process.env.GATEWAY_MAXSIZE ? Number.parseInt(process.env.GATEWAY_MAXSIZE, 10) : null
export const GATEWAY_EXCLUDED_MIMES = process.env.GATEWAY_EXCLUDED_MIMES 
  ? process.env.GATEWAY_EXCLUDED_MIMES.split(',').map(m => m.trim())
  : []

const envMaxAge = process.env.GATEWAY_CACHE_MAX_AGE ? Number.parseInt(process.env.GATEWAY_CACHE_MAX_AGE, 10) : 31536000
export const GATEWAY_CACHE_MAX_AGE = Math.max(envMaxAge, 2592000) // Minimum 1 month

export const GATEWAY_CACHE_API_BY_USER = process.env.GATEWAY_CACHE_API_BY_USER === 'true'
export const GATEWAY_CACHE_MEDIA_BY_USER = process.env.GATEWAY_CACHE_MEDIA_BY_USER === 'true'
