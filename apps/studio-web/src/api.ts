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
    return res.data?.[0] || null
  },

  createModel: async (name: string, collectionName?: string) => {
    const res = await apiClient.post('models', { name, collectionName, isPersisted: true })
    return res.data?.[0] || null
  },

  updateModel: async (id: string, data: any) => {
    const res = await apiClient.put(`models/${id}`, data)
    return res.data?.[0] || null
  },

  getModelProperties: async (id: string) => {
    const res = await apiClient.get(`properties`, { modelId: id })
    return res.data || []
  },

  addProperty: async (modelId: string, propertyData: any) => {
    const res = await apiClient.post(`properties`, { ...propertyData, modelId })
    return res.data?.[0] || null
  },

  updateProperty: async (id: string, data: any) => {
    const res = await apiClient.put(`properties/${id}`, data)
    return res.data?.[0] || null
  },
  
  deleteProperty: async (id: string) => {
    await apiClient.delete(`properties/${id}`)
  }
}
