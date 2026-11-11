import { describe, it, expect } from '@jest/globals';
import { calculateTokenCost, GEMINI_MODEL_PRICING } from '../cost';

describe('Token Cost Calculator', () => {
   it('should calculate accurate cost for gemini-2.5-flash', () => {
      const usage = {
         promptTokenCount: 10_000,
         candidatesTokenCount: 1_000,
         thoughtsTokenCount: 500,
         totalTokenCount: 11_500,
      };

      const result = calculateTokenCost(usage, 'gemini-2.5-flash');

      expect(result.prompt).toBe(10_000);
      expect(result.candidates).toBe(1_000);
      expect(result.thinking).toBe(500);
      expect(result.total).toBe(11_500);

      // (10_000 * 0.075 + 1500 * 0.30) / 1_000_000 = (0.75 + 0.45) / 1_000_000 = 0.0012 USD
      expect(result.costUsd).toBe(0.0012);
   });

   it('should handle zero or undefined tokens gracefully', () => {
      const result = calculateTokenCost(undefined);

      expect(result.prompt).toBe(0);
      expect(result.candidates).toBe(0);
      expect(result.thinking).toBe(0);
      expect(result.total).toBe(0);
      expect(result.costUsd).toBe(0);
   });

   it('should support alternative models with distinct pricing', () => {
      const usage = {
         promptTokenCount: 1_000_000,
         candidatesTokenCount: 100_000,
         thoughtsTokenCount: 0,
         totalTokenCount: 1_100_000,
      };

      const result = calculateTokenCost(usage, 'gemini-1.5-pro');

      // 1M * 1.25 + 0.1M * 5.00 = 1.25 + 0.50 = 1.75 USD
      expect(result.costUsd).toBe(1.75);
   });
});
