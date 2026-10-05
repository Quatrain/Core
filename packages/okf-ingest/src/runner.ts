import { GoogleGenAI, Schema } from '@google/genai';
import { calculateTokenCost } from './cost';
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
 * Standard implementation of AiStructuredRunner backed by Google's Gemini SDK (@google/genai).
 */
export class GeminiStructuredRunner implements AiStructuredRunner {
   private ai: GoogleGenAI;
   private defaultModel: string;

   constructor(config: GeminiRunnerConfig) {
      if (!config.apiKey) {
         throw new Error('[GeminiStructuredRunner] API key is required');
      }
      this.ai = new GoogleGenAI({ apiKey: config.apiKey });
      this.defaultModel = config.defaultModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
   }

   async generateStructured<T = Record<string, unknown>>(
      prompt: string,
      schema: unknown,
      options?: AiRunnerOptions
   ): Promise<AiRunnerResponse<T>> {
      const model = options?.model || this.defaultModel;

      const response = await this.ai.models.generateContent({
         model,
         contents: prompt,
         config: {
            responseMimeType: 'application/json',
            responseSchema: schema as Schema,
            temperature: options?.temperature,
            systemInstruction: options?.systemInstruction,
         },
      });

      const rawText = response.text || '';
      if (!rawText) {
         throw new Error(`[GeminiStructuredRunner] Empty response received from model ${model}`);
      }

      const data = JSON.parse(rawText) as T;
      const usage: OkfTokenUsage = calculateTokenCost(response.usageMetadata, model);

      return {
         data,
         usage,
         rawText,
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

      const response = await this.ai.models.generateContent({
         model,
         contents,
         config: {
            responseMimeType: 'application/json',
            responseSchema: schema as Schema,
            temperature: options?.temperature,
            systemInstruction: options?.systemInstruction,
         },
      });

      const rawText = response.text || '';
      if (!rawText) {
         throw new Error(`[GeminiStructuredRunner] Empty multimodal response received from model ${model}`);
      }

      const data = JSON.parse(rawText) as T;
      const usage: OkfTokenUsage = calculateTokenCost(response.usageMetadata, model);

      return {
         data,
         usage,
         rawText,
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
