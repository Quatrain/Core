import { AbstractAiAdapter } from '@quatrain/ai'
import { GoogleGenAI } from '@google/genai'

export class GeminiAdapter extends AbstractAiAdapter {
   protected _ai: GoogleGenAI | null = null
   protected _apiKey: string

   constructor(apiKey: string) {
      super()
      this._apiKey = apiKey
   }

   init(): void {
      this._ai = new GoogleGenAI({ apiKey: this._apiKey })
   }

   async generateText(prompt: string, options?: any): Promise<string> {
      if (!this._ai) this.init()
      
      const model = options?.model || 'gemini-2.5-flash'
      const response = await this._ai!.models.generateContent({
         model,
         contents: prompt,
      })

      return response.text || ''
   }

   async generateStructured(prompt: string, schema: any, options?: any): Promise<any> {
      if (!this._ai) this.init()

      const model = options?.model || 'gemini-2.5-flash'
      const response = await this._ai!.models.generateContent({
         model,
         contents: prompt,
         config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
         }
      })

      if (!response.text) {
         throw new Error('No text returned from Gemini API')
      }

      return JSON.parse(response.text)
   }
}
