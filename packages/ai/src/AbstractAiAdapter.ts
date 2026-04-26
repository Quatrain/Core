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
   abstract generateStructured(prompt: string, schema: any, options?: any): Promise<any>
}
