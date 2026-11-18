import { GeminiAdapter } from '../GeminiAdapter'

jest.mock('@google/genai', () => ({
   GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
         generateContent: jest.fn().mockResolvedValue({
            text: 'mock AI response',
            usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4, totalTokenCount: 7 }
         })
      }
   }))
}))

describe('GeminiAdapter', () => {
   let adapter: GeminiAdapter

   beforeEach(() => {
      adapter = new GeminiAdapter('fake-api-key')
   })

   it('should instantiate and generate text', async () => {
      const response = await adapter.generateText('Hello')
      expect(response).toBe('mock AI response')
   })

   it('should report the token usage of a text generation', async () => {
      const onUsage = jest.fn()
      await adapter.generateText('Hello', { onUsage })
      expect(onUsage).toHaveBeenCalledWith({ promptTokenCount: 3, candidatesTokenCount: 4, totalTokenCount: 7 })
   })
})
