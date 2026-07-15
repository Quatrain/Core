import { EndpointHandler, ServerAdapter, EndpointOptions, HttpStatus } from '@quatrain/api'
import { BaseObject, DataObjectClass } from '@quatrain/core'
import { Backend } from '@quatrain/backend'

export const ListEndpoint = (ModelClass: typeof BaseObject): EndpointHandler => {
   return (router: ServerAdapter, path: string, options: EndpointOptions) => {
      
      router.get(path, async (req, res) => {
         try {
            let q = (ModelClass as any).query()
            
            let batchVal = 100; // Increase default limit to 100 to show more documents by default, or support query param
            let offsetVal = 0;
            
            // Apply all query parameters as exact match filters, except pagination parameters
            for (const [key, value] of Object.entries(req.query)) {
               if (key === 'batch' || key === '_batch') {
                  batchVal = Number(value);
               } else if (key === 'offset' || key === '_offset') {
                  offsetVal = Number(value);
               } else {
                  q = q.where(key, value, 'equals');
               }
            }
            
            q = q.batch(batchVal).offset(offsetVal);
            
            const results = await q.execute('dataObjects');
            
            res.json({
               items: results.items.map((r: DataObjectClass<any>) => r.toJSON()),
               meta: results.meta
            });
         } catch (e) {
            Backend.error(`[API Error] GET (List): ${(e as Error).message}`);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: (e as Error).message });
         }
      })
      
   }
}
