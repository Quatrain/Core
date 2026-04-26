import { AbstractRepositoryAdapter } from './AbstractRepositoryAdapter'

/**
 * Singleton to access the configured Repository adapter
 */
export class CodeRepository {
   protected static _adapter: AbstractRepositoryAdapter | null = null

   /**
    * Set the Repository adapter to be used globally
    * @param adapter The configured adapter instance
    */
   public static setAdapter(adapter: AbstractRepositoryAdapter) {
      CodeRepository._adapter = adapter
   }

   /**
    * Get the current Repository adapter
    * @returns The configured Repository adapter
    * @throws Error if no adapter has been set
    */
   public static getAdapter(): AbstractRepositoryAdapter {
      if (!CodeRepository._adapter) {
         throw new Error('No Repository adapter configured. Please call CodeRepository.setAdapter() first.')
      }
      return CodeRepository._adapter
   }
}
