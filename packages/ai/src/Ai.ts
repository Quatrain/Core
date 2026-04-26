import { AbstractAiAdapter } from './AbstractAiAdapter'

/**
 * Singleton to access the configured AI adapter
 */
export class Ai {
   protected static _adapter: AbstractAiAdapter | null = null

   /**
    * Set the AI adapter to be used globally
    * @param adapter The configured adapter instance
    */
   public static setAdapter(adapter: AbstractAiAdapter) {
      Ai._adapter = adapter
   }

   /**
    * Get the current AI adapter
    * @returns The configured AI adapter
    * @throws Error if no adapter has been set
    */
   public static getAdapter(): AbstractAiAdapter {
      if (!Ai._adapter) {
         throw new Error('No AI adapter configured. Please call Ai.setAdapter() first.')
      }
      return Ai._adapter
   }
}
