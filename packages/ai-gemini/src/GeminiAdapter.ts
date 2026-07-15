import { AbstractAiAdapter } from '@quatrain/ai'
import { GoogleGenAI } from '@google/genai'

/**
 * AI Adapter implementation for Google's Gemini models using the official genai SDK.
 */
export class GeminiAdapter extends AbstractAiAdapter {
   protected _ai: GoogleGenAI | null = null
   protected _apiKey: string

   constructor(apiKey: string) {
      super()
      this._apiKey = apiKey
   }

   /**
    * Initializes the internal GoogleGenAI client with the provided API key.
    */
   init(): void {
      this._ai = new GoogleGenAI({ apiKey: this._apiKey })
   }

   /**
    * Sends a textual prompt to the Gemini API and retrieves the generated text response.
    * 
    * @param prompt - The instruction or query to send to the model.
    * @param options - Configuration options. Can include a `model` string identifier.
    * @returns The generated response string.
    */
   async generateText(prompt: string, options?: any): Promise<string> {
      if (!this._ai) this.init()
      
      const model = options?.model || 'gemini-2.5-flash'
      const response = await this._ai!.models.generateContent({
         model,
         contents: prompt,
      })

      return response.text || ''
   }

   /**
    * Instructs the Gemini model to output structured JSON data conforming to a given schema.
    * 
    * @param prompt - The instruction or context.
    * @param schema - The expected JSON schema structure.
    * @param options - Additional options including the `model` identifier.
    * @returns The parsed JSON object returned by the model.
    * @throws {Error} If the API does not return valid text.
    */
   async generateStructured(prompt: any, schema: any, options?: any): Promise<any> {
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

   /**
    * Sends a textual prompt to the Gemini API and returns an async iterable of text chunks.
    * 
    * @param prompt - The instruction or query to send to the model.
    * @param options - Configuration options including the `model` identifier.
    * @returns An async iterable stream of text chunks.
    */
   async generateTextStream(prompt: string, options?: any): Promise<AsyncIterable<string>> {
      if (!this._ai) this.init()

      const model = options?.model || 'gemini-2.5-flash'
      const responseStream = await this._ai!.models.generateContentStream({
         model,
         contents: prompt,
      })

      async function* makeGenerator() {
         for await (const chunk of responseStream) {
            yield chunk.text || ''
         }
      }

      return makeGenerator()
   }
}
