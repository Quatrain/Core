import { OkfTokenUsage } from './types';

/**
 * Rates per 1,000,000 tokens (USD).
 */
export interface ModelPricing {
   inputRate: number;
   outputRate: number;
}

export const GEMINI_MODEL_PRICING: Record<string, ModelPricing> = {
   'gemini-2.5-flash': { inputRate: 0.075, outputRate: 0.30 },
   'gemini-2.5-pro': { inputRate: 1.25, outputRate: 5.00 },
   'gemini-2.0-flash': { inputRate: 0.10, outputRate: 0.40 },
   'gemini-2.0-flash-lite': { inputRate: 0.075, outputRate: 0.30 },
   'gemini-1.5-flash': { inputRate: 0.075, outputRate: 0.30 },
   'gemini-1.5-pro': { inputRate: 1.25, outputRate: 5.00 },
};

const DEFAULT_PRICING: ModelPricing = { inputRate: 0.075, outputRate: 0.30 };

export interface RawTokenUsageMetadata {
   promptTokenCount?: number;
   candidatesTokenCount?: number;
   thoughtsTokenCount?: number;
   totalTokenCount?: number;
}

/**
 * Calculates exact token counts and cost in USD from usage metadata.
 *
 * @param usage - Raw usage metadata returned from the AI model API.
 * @param model - Identifier of the model used.
 * @returns Standardized OkfTokenUsage with cost in USD.
 */
export function calculateTokenCost(
   usage: RawTokenUsageMetadata | null | undefined,
   model = 'gemini-2.5-flash'
): OkfTokenUsage {
   const prompt = usage?.promptTokenCount ?? 0;
   const candidates = usage?.candidatesTokenCount ?? 0;
   const thinking = usage?.thoughtsTokenCount ?? 0;
   const output = candidates + thinking;
   const total = usage?.totalTokenCount ?? (prompt + output);

   const pricing = GEMINI_MODEL_PRICING[model] ?? DEFAULT_PRICING;
   const rawCost = (prompt * pricing.inputRate + output * pricing.outputRate) / 1_000_000;
   const costUsd = Number(rawCost.toFixed(6));

   return {
      prompt,
      candidates,
      thinking,
      total,
      costUsd,
   };
}
