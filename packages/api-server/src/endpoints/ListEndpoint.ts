import { EndpointHandler, ServerAdapter, EndpointOptions } from '@quatrain/api'
import { BaseObject, DataObjectClass } from '@quatrain/core'
import { Backend } from '@quatrain/backend'

export const ListEndpoint = (ModelClass: typeof BaseObject): EndpointHandler => {
   return (router: ServerAdapter, path: string, options: EndpointOptions) => {
      
      router.get(path, async (req, res) => {
         try {
            let q = (ModelClass as any).query()
            
            // Apply all query parameters as exact match filters
            for (const [key, value] of Object.entries(req.query)) {
               q = q.where(key, value, 'equals')
            }
            
            const results = await q.execute('dataObjects')
            
            res.json({
               items: results.items.map((r: DataObjectClass<any>) => r.toJSON()),
               meta: results.meta
            })
         } catch (e) {
            Backend.error(`[API Error] GET (List): ${(e as Error).message}`)
            res.status(500).json({ error: (e as Error).message })
         }
      })
      
   }
}
