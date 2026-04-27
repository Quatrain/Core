import { SchemaDelta } from '@quatrain/backend'

export class SchemaDiffer {
   /**
    * Compares two sets of properties and returns the delta.
    * Matches properties by name.
    */
   static compare(oldProps: any[], newProps: any[]): SchemaDelta {
      const added: any[] = []
      const removed: any[] = []
      const modified: { old: any; new: any }[] = []

      // Create maps for faster lookup by lowercase name
      const oldMap = new Map<string, any>()
      oldProps.forEach(p => {
         if (p && p.name) oldMap.set(p.name.toLowerCase(), p)
      })

      const newMap = new Map<string, any>()
      newProps.forEach(p => {
         if (p && p.name) newMap.set(p.name.toLowerCase(), p)
      })

      // Find added and modified
      for (const [name, newProp] of newMap.entries()) {
         if (!oldMap.has(name)) {
            added.push(newProp)
         } else {
            const oldProp = oldMap.get(name)
            
            // Check if type changed
            const newType = newProp.type || newProp.constructor.name
            const oldType = oldProp.type || oldProp.constructor.name
            
            if (newType !== oldType) {
               modified.push({ old: oldProp, new: newProp })
            }
         }
      }

      // Find removed
      for (const [name, oldProp] of oldMap.entries()) {
         if (!newMap.has(name)) {
            removed.push(oldProp)
         }
      }

      return { added, removed, modified }
   }
}
