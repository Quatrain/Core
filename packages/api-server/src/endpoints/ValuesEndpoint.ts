import { EndpointHandler, ServerAdapter, EndpointOptions } from '@quatrain/api'
import { BaseObject, DataObjectClass } from '@quatrain/core'
import { Backend } from '@quatrain/backend'

export const ValuesEndpoint = (ModelClass: typeof BaseObject): EndpointHandler => {
   return (router: ServerAdapter, path: string, options: EndpointOptions) => {
      // Create the endpoint route, assuming 'path' is something like '/api/users'
      // We'll map it to '/api/users/values' 
      const valuesPath = path.endsWith('/') ? `${path}values` : `${path}/values`
      
      router.get(valuesPath, async (req, res) => {
         try {
            const results = await (ModelClass as any).query()
               .where('status', 'deleted', 'notEquals')
               .execute('dataObjects')
            
            // Identify exposed fields from PROPS_DEFINITION
            const propsDef = (ModelClass as any).PROPS_DEFINITION || []
            const exposedFields = propsDef
               .filter((p: any) => p.htmlType && p.htmlType !== 'off')
               .map((p: any) => p.name)
            
            const searchFields = ['name', ...propsDef
               .filter((p: any) => p.type === 'StringProperty' && p.fullSearch === true)
               .map((p: any) => p.name)]
            
            let values = results.items.map((dataObject: DataObjectClass<any>) => {
               const payload: any = { 
                  value: dataObject.uid,
                  name: dataObject.has('name') ? dataObject.get('name') : dataObject.uid
               }
               
               for (const field of exposedFields) {
                  if (dataObject.has(field)) {
                     payload[field] = dataObject.get(field)
                  }
               }
               
               const searchVals = searchFields.map(f => {
                  const val = dataObject.get(f)
                  return typeof val === 'string' ? val : ''
               }).filter(Boolean)
               payload._search = searchVals.join(' ').toLowerCase()
               
               return payload
            })
            
            const qParam = req.query.q as string
            if (qParam) {
               const searchStr = qParam.toLowerCase()
               values = values.filter((payload: any) => {
                  return searchFields.some(field => {
                     const val = payload[field]
                     return typeof val === 'string' && val.toLowerCase().includes(searchStr)
                  })
               })
            }
            
            res.json(values)
         } catch (e) {
            Backend.error(`[API Error] GET ${valuesPath}: ${(e as Error).message}`)
            res.status(500).json({ error: (e as Error).message })
         }
      })
   }
}
