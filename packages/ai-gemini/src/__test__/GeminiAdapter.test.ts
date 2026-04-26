import { GeminiAdapter } from '../GeminiAdapter'

jest.mock('@google/genai', () => ({
   GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
         generateContent: jest.fn().mockResolvedValue({ text: 'mock AI response' })
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
})
