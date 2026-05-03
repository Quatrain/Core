import { ApiClient } from '@quatrain/api-client'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

// Initialize the isomorphic API Client
export const apiClient = ApiClient.instance(API_BASE_URL)

export const api = {
  getModels: async () => {
    const res = await apiClient.get('models')
    return res.data || []
  },
  
  getModel: async (id: string) => {
    const res = await apiClient.get(`models/${id}`)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },

  createModel: async (name: string, collectionName?: string) => {
    const res = await apiClient.post('models', { name, collectionName, isPersisted: true })
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },

  updateModel: async (id: string, data: any) => {
    const res = await apiClient.put(`models/${id}`, data)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },

  getModelProperties: async (id: string, version?: number) => {
    const filters: any = { studioModel: id }
    if (version !== undefined) {
       filters.version = version
    }
    const res = await apiClient.get(`properties`, filters)
    return (res.data || []).filter((p: any) => p.status !== 'deleted')
  },

  addProperty: async (studioModel: string, propertyData: any) => {
    const res = await apiClient.post(`properties`, { ...propertyData, studioModel })
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },

  updateProperty: async (id: string, data: any) => {
    const res = await apiClient.put(`properties/${id}`, data)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },
  
  deleteProperty: async (id: string) => {
    await apiClient.delete(`properties/${id}`, {})
  },

  getBackends: async () => {
    const res = await apiClient.get('backends')
    return res.data || []
  },

  createBackend: async (data: any) => {
    const res = await apiClient.post('backends', data)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },

  deleteBackend: async (id: string) => {
    await apiClient.delete(`backends/${id}`, {})
  },

  getDeployments: async (studioBackend: string) => {
    const res = await apiClient.get('deployments', { studioBackend })
    return res.data || []
  },

  getModelStats: async (studioModel: string, studioBackend: string) => {
    const res = await apiClient.get(`models/${studioModel}/stats`, { studioBackend })
    return res
  },

  deployModel: async (studioModel: string, version: number, studioBackend: string) => {
    const res = await apiClient.post(`models/${studioModel}/deploy`, { version, studioBackend })
    return res.data
  },

  // App & Environments
  getProjects: async () => {
    const res = await apiClient.get('projects')
    return res.data || []
  },
  createProject: async (data: any) => {
    const res = await apiClient.post('projects', data)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },
  updateProject: async (id: string, data: any) => {
    const res = await apiClient.put(`projects/${id}`, data)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },

  getEnvironments: async (studioProject: string) => {
    const res = await apiClient.get('environments', { studioProject })
    return res.data || []
  },
  createEnvironment: async (data: any) => {
    const res = await apiClient.post('environments', data)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },
  updateEnvironment: async (id: string, data: any) => {
    const res = await apiClient.put(`environments/${id}`, data)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },
  deleteEnvironment: async (id: string) => {
    await apiClient.delete(`environments/${id}`, {})
  },
  deployEnvironment: async (id: string, config: any) => {
    const res = await apiClient.post(`environments/${id}/deploy`, config)
    return res.data
  },

  // Storages
  getStorages: async () => {
    const res = await apiClient.get('storages')
    return res.data || []
  },
  createStorage: async (data: any) => {
    const res = await apiClient.post('storages', data)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },
  updateStorage: async (id: string, data: any) => {
    const res = await apiClient.put(`storages/${id}`, data)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },
  deleteStorage: async (id: string) => {
    await apiClient.delete(`storages/${id}`, {})
  },

  // Auths
  getAuths: async () => {
    const res = await apiClient.get('auths')
    return res.data || []
  },
  createAuth: async (data: any) => {
    const res = await apiClient.post('auths', data)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },
  deleteAuth: async (id: string) => {
    await apiClient.delete(`auths/${id}`, {})
  },

  // Secrets
  getSecrets: async (studioEnvironment?: string) => {
    const res = await apiClient.get('secrets', studioEnvironment ? { studioEnvironment } : {})
    return res.data || []
  },
  createSecret: async (data: any) => {
    const res = await apiClient.post('secrets', data)
    return res.data
  },
  updateSecret: async (id: string, data: any) => {
    const res = await apiClient.put(`secrets/${id}`, data)
    return res.data
  },
  deleteSecret: async (id: string) => {
    await apiClient.delete(`secrets/${id}`, {})
  },

  // Widgets
  getWidgets: async () => {
    const res = await apiClient.get('widgets')
    return res.data || []
  },
  createWidget: async (name: string, widgetType: string, studioModel?: string) => {
    const res = await apiClient.post('widgets', { name, widgetType, studioModel, isPersisted: true })
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },
  getWidget: async (id: string) => {
    const res = await apiClient.get(`widgets/${id}`)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  },
  updateWidget: async (id: string, data: any) => {
    const res = await apiClient.put(`widgets/${id}`, data)
    return (Array.isArray(res.data) ? res.data[0] : res.data) || null
  }
}
