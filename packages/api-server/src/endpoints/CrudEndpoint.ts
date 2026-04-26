import { EndpointHandler, ServerAdapter, EndpointOptions } from '@quatrain/api'
import { BaseObject, DataObjectClass } from '@quatrain/core'
import { Backend } from '@quatrain/backend'

export const CrudEndpoint = (ModelClass: typeof BaseObject): EndpointHandler => {
   return (router: ServerAdapter, path: string, options: EndpointOptions) => {
      const methods = options.methods || ['CREATE', 'READ', 'UPDATE', 'DELETE']

      // C: Create
      if (methods.includes('CREATE')) {
         router.post(path, async (req, res) => {
            try {
               const data = req.body
               const newObj = await ModelClass.factory()
               
               Object.keys(data).forEach((key) => {
                  if (newObj.has(key)) {
                     newObj.set(key, data[key])
                  }
               })
               
               await (newObj as any).save()
               res.status(201).json(newObj.dataObject.toJSON())
            } catch (e) {
               Backend.error(`[API Error] POST: ${(e as Error).message}`)
               res.status(400).json({ error: (e as Error).message })
            }
         })
      }

      // R: Read (Single by ID)
      if (methods.includes('READ')) {
         const getPath = path.endsWith('/') ? `${path}:id` : `${path}/:id`
         router.get(getPath, async (req, res) => {
            try {
               const obj = await (ModelClass as any).fromBackend(req.params.id)
               if (!obj) {
                  return res.status(404).json({ error: 'Object not found' })
               }
               res.json(obj.dataObject.toJSON())
            } catch (e) {
               Backend.error(`[API Error] GET /${req.params.id}: ${(e as Error).message}`)
               res.status(500).json({ error: (e as Error).message })
            }
         })
      }

      // U: Update
      if (methods.includes('UPDATE')) {
         const putPath = path.endsWith('/') ? `${path}:id` : `${path}/:id`
         router.put(putPath, async (req, res) => {
            try {
               const data = req.body
               const obj = await (ModelClass as any).fromBackend(req.params.id)
                  
               if (!obj) {
                  return res.status(404).json({ error: 'Object not found' })
               }
               
               Object.keys(data).forEach((key) => {
                  if (obj.has(key)) {
                     obj.set(key, data[key])
                  }
               })
               
               await obj.save()
               res.json(obj.dataObject.toJSON())
            } catch (e) {
               Backend.error(`[API Error] PUT /${req.params.id}: ${(e as Error).message}`)
               res.status(400).json({ error: (e as Error).message })
            }
         })
      }

      // D: Delete
      if (methods.includes('DELETE')) {
         const deletePath = path.endsWith('/') ? `${path}:id` : `${path}/:id`
         router.delete(deletePath, async (req, res) => {
            try {
               const obj = await (ModelClass as any).fromBackend(req.params.id)
                  
               if (!obj) {
                  return res.status(404).json({ error: 'Object not found' })
               }
               
               await obj.delete()
               res.json({ success: true })
            } catch (e) {
               Backend.error(`[API Error] DELETE /${req.params.id}: ${(e as Error).message}`)
               res.status(500).json({ error: (e as Error).message })
            }
         })
      }
   }
}
