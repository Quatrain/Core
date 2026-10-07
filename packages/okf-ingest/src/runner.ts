import { GeminiAdapter } from '@quatrain/ai-gemini';
import { calculateTokenCost, RawTokenUsageMetadata } from './cost';
import {
   AiRunnerOptions,
   AiRunnerResponse,
   AiStructuredRunner,
   MultimodalPart,
   OkfTokenUsage,
} from './types';

export interface GeminiRunnerConfig {
   apiKey: string;
   defaultModel?: string;
}

/**
 * Standard implementation of AiStructuredRunner backed by Quatrain's GeminiAdapter (@quatrain/ai-gemini).
 */
export class GeminiStructuredRunner implements AiStructuredRunner {
   private adapter: GeminiAdapter;
   private defaultModel: string;

   constructor(config: GeminiRunnerConfig) {
      if (!config.apiKey) {
         throw new Error('[GeminiStructuredRunner] API key is required');
      }
      this.adapter = new GeminiAdapter(config.apiKey);
      this.adapter.init();
      this.defaultModel = config.defaultModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
   }

   async generateStructured<T = Record<string, unknown>>(
      prompt: string,
      schema: unknown,
      options?: AiRunnerOptions
   ): Promise<AiRunnerResponse<T>> {
      const model = options?.model || this.defaultModel;
      let rawUsage: RawTokenUsageMetadata | undefined;

      const data = (await this.adapter.generateStructured(prompt, schema, {
         model,
         temperature: options?.temperature,
         systemInstruction: options?.systemInstruction,
         maxOutputTokens: options?.maxOutputTokens,
         onUsage: (u: unknown) => {
            if (typeof u === 'object' && u !== null) {
               rawUsage = u as RawTokenUsageMetadata;
            }
         },
      })) as T;

      const usage: OkfTokenUsage = rawUsage
         ? calculateTokenCost(rawUsage, model)
         : calculateTokenCost(
              {
                 promptTokenCount: Math.ceil(prompt.length / 4),
                 candidatesTokenCount: Math.ceil(JSON.stringify(data).length / 4),
                 totalTokenCount: Math.ceil((prompt.length + JSON.stringify(data).length) / 4),
              },
              model
           );

      return {
         data,
         usage,
         rawText: JSON.stringify(data),
      };
   }

   async generateStructuredMultimodal<T = Record<string, unknown>>(
      prompt: string,
      parts: MultimodalPart[],
      schema: unknown,
      options?: AiRunnerOptions
   ): Promise<AiRunnerResponse<T>> {
      const model = options?.model || this.defaultModel;
      const contents = [
         prompt,
         ...parts.map((p) => ({
            inlineData: {
               mimeType: p.mimeType,
               data: p.data,
            },
         })),
      ];

      let rawUsage: RawTokenUsageMetadata | undefined;
      const data = (await this.adapter.generateStructured(contents, schema, {
         model,
         temperature: options?.temperature,
         systemInstruction: options?.systemInstruction,
         maxOutputTokens: options?.maxOutputTokens,
         onUsage: (u: unknown) => {
            if (typeof u === 'object' && u !== null) {
               rawUsage = u as RawTokenUsageMetadata;
            }
         },
      })) as T;

      const usage: OkfTokenUsage = rawUsage
         ? calculateTokenCost(rawUsage, model)
         : calculateTokenCost(
              {
                 promptTokenCount: Math.ceil(prompt.length / 4),
                 candidatesTokenCount: Math.ceil(JSON.stringify(data).length / 4),
                 totalTokenCount: Math.ceil((prompt.length + JSON.stringify(data).length) / 4),
              },
              model
           );

      return {
         data,
         usage,
         rawText: JSON.stringify(data),
      };
   }
}

/**
 * Resolves or instantiates an AiStructuredRunner from provided parameters or environment.
 */
export function resolveStructuredRunner(
   apiKey?: string,
   runner?: AiStructuredRunner
): AiStructuredRunner {
   if (runner) {
      return runner;
   }

   const resolvedKey = apiKey || process.env.GEMINI_API_KEY;
   if (resolvedKey) {
      return new GeminiStructuredRunner({ apiKey: resolvedKey });
   }

   throw new Error(
      '[OKF Ingest] An AiStructuredRunner or an API key (e.g. GEMINI_API_KEY) must be provided.'
   );
}
