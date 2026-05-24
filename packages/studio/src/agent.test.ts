import { Ai } from '@quatrain/ai'
import { StudioAgent } from './agent'
import { Backend } from '@quatrain/backend'
import { MockAdapter } from '@quatrain/backend'
import { StudioModel } from './models/StudioModel'

describe('StudioAgent', () => {
   beforeAll(() => {
      Backend.addBackend(new MockAdapter(), 'default', true)
   })

   test('should generate model from prompt and create properties', async () => {
      const mockAdapter = {
         generateStructured: jest.fn().mockResolvedValue({
            name: 'Book',
            collectionName: 'book',
            isPersisted: true,
            properties: [
               { name: 'title', type: 'StringProperty', mandatory: true },
               { name: 'pages', type: 'NumberProperty', mandatory: false }
            ]
         })
      }

      jest.spyOn(Ai, 'getAdapter').mockReturnValue(mockAdapter as any)

      const model = await StudioAgent.generateModelFromPrompt('Create a Book model', 'proj-123')

      expect(Ai.getAdapter).toHaveBeenCalled()
      expect(mockAdapter.generateStructured).toHaveBeenCalled()
      expect(model).toBeInstanceOf(StudioModel)
      expect(model.val('name')).toBe('Book')
      expect(model.val('collectionName')).toBe('book')
      expect(model.val('isPersisted')).toBe(true)
   })
})
