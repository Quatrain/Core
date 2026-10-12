import { AbstractAiAdapter, Ai } from '@quatrain/ai';
import { GeminiAdapter } from '@quatrain/ai-gemini';

export interface ResolveAdapterOptions {
   adapter?: AbstractAiAdapter;
   apiKey?: string;
}

/**
 * Resolves an active AbstractAiAdapter instance conforming to Quatrain Core AI standards.
 * Priority order:
 * 1. Explicit adapter passed in call options.
 * 2. Globally registered adapter via @quatrain/ai (Ai.getAdapter()).
 * 3. Fallback GeminiAdapter instantiated with provided apiKey or process.env.GEMINI_API_KEY.
 */
export function resolveAiAdapter(options: ResolveAdapterOptions = {}): AbstractAiAdapter {
   if (options.adapter) {
      return options.adapter;
   }

   try {
      const globalAdapter = Ai.getAdapter();
      if (globalAdapter) {
         return globalAdapter;
      }
   } catch {
      // Global adapter not registered
   }

   const resolvedKey = options.apiKey || process.env.GEMINI_API_KEY;
   if (resolvedKey) {
      const adapter = new GeminiAdapter(resolvedKey);
      adapter.init();
      return adapter;
   }

   throw new Error(
      '[OKF Ingest] No AI adapter configured. Please provide an AbstractAiAdapter via options.adapter, call Ai.setAdapter(), or supply an API key.'
   );
}
