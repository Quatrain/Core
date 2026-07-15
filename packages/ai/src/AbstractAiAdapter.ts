/**
 * Abstract blueprint for AI model provider adapters.
 */
export abstract class AbstractAiAdapter {
   /**
    * Adapter specific initialization
    */
   abstract init(): void

   /**
    * Generate plain text from a prompt
    * @param prompt 
    * @param options 
    */
   abstract generateText(prompt: string, options?: any): Promise<string>

   /**
    * Generate structured data from a prompt
    * @param prompt 
    * @param schema The expected output schema
    * @param options 
    */
   abstract generateStructured(prompt: any, schema: any, options?: any): Promise<any>

   /**
    * Generate a streaming text response from a prompt.
    * @param prompt - The instruction or query.
    * @param options - Configuration options.
    * @returns A promise resolving to an async iterable stream of text chunks.
    */
   generateTextStream?(prompt: string, options?: any): Promise<AsyncIterable<string>>
}
