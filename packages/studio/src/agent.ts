import { Ai } from '@quatrain/ai'
import { StudioModel } from './models/StudioModel'
import { StudioProperty } from './models/StudioProperty'
import { StringProperty, NumberProperty, BooleanProperty, DateTimeProperty } from '@quatrain/core'

/**
 * The Studio Agent uses the configured AI adapter to translate 
 * natural language prompts into SQLite-persisted Studio models.
 */
export class StudioAgent {
   
   /**
    * Parses a prompt and creates a StudioModel with its StudioProperties
    * @param prompt User's natural language request
    * @param projectId The ID of the current StudioProject
    * @returns The generated StudioModel
    */
   static async generateModelFromPrompt(prompt: string, projectId: string): Promise<StudioModel> {
      const adapter = Ai.getAdapter()

      const schema = {
         type: 'object',
         properties: {
            name: { type: 'string', description: 'The PascalCase class name for the model (e.g. Invoice)' },
            collectionName: { type: 'string', description: 'The database collection name in lowercase (e.g. invoice)' },
            isPersisted: { type: 'boolean', description: 'True if this should be saved to database, usually true' },
            properties: {
               type: 'array',
               items: {
                  type: 'object',
                  properties: {
                     name: { type: 'string', description: 'The camelCase property name' },
                     type: { type: 'string', enum: ['StringProperty', 'NumberProperty', 'BooleanProperty', 'DateTimeProperty'] },
                     mandatory: { type: 'boolean' }
                  },
                  required: ['name', 'type', 'mandatory']
               }
            }
         },
         required: ['name', 'collectionName', 'isPersisted', 'properties']
      }

      const systemPrompt = `You are a Quatrain Framework expert. Extract the model requested by the user.`
      const result = await adapter.generateStructured(`${systemPrompt}\n\nUser prompt: ${prompt}`, schema)

      // Create the model
      const model = await StudioModel.factory()
      model.set('projectId', projectId)
      model.set('name', result.name)
      model.set('collectionName', result.collectionName)
      model.set('isPersisted', result.isPersisted)
      await model.save()

      // Create its properties
      if (result.properties && Array.isArray(result.properties)) {
         for (const prop of result.properties) {
            const property = await StudioProperty.factory()
            property.set('modelId', model.uid) // Assuming uid is the PK
            property.set('name', prop.name)
            property.set('propertyType', prop.type)
            property.set('mandatory', prop.mandatory)
            await property.save()
         }
      }

      return model
   }
}
