import { Core } from '@quatrain/core';
import { AbstractIngestionAdapter } from './AbstractIngestionAdapter';

export class Ingestion extends Core {
   static defaultAdapter = '';
   protected static _adapters: Record<string, AbstractIngestionAdapter> = {};

   /**
    * Registers an instantiated ingestion adapter into the global registry.
    * 
    * @param adapter - The initialized adapter (e.g. `OcrIngestionAdapter`).
    * @param alias - The string identifier to register it under.
    * @param setDefault - Whether this should become the default backend.
    */
   static addAdapter(
      adapter: AbstractIngestionAdapter,
      alias: string,
      setDefault: boolean = false
   ) {
      this._adapters[alias] = adapter;
      this.info(`Added ingestion adapter ${adapter.constructor.name} with alias '${alias}'`);
      if (setDefault || !this.defaultAdapter) {
         this.defaultAdapter = alias;
      }
   }

   /**
    * Retrieves a previously registered ingestion adapter by its alias.
    * 
    * @param alias - The target registry identifier. Defaults to `defaultAdapter`.
    */
   static getAdapter<T extends AbstractIngestionAdapter>(
      alias: string = this.defaultAdapter
   ): T {
      if (this._adapters[alias]) {
         return this._adapters[alias] as T;
      } else {
         throw new Error(`Unknown ingestion adapter alias: '${alias}'`);
      }
   }
}
