import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { AbstractAiAdapter, Ai } from '@quatrain/ai';
import { GeminiAdapter } from '@quatrain/ai-gemini';
import { resolveAiAdapter } from '../adapter';

class DummyAdapter extends AbstractAiAdapter {
   init(): void {}
   async generateText(): Promise<string> {
      return 'dummy';
   }
   async generateStructured<T>(): Promise<T> {
      return {} as T;
   }
}

describe('resolveAiAdapter', () => {
   beforeEach(() => {
      // @ts-expect-error Resetting private static property for test isolation
      Ai._adapter = null;
   });

   afterEach(() => {
      // @ts-expect-error Resetting private static property for test isolation
      Ai._adapter = null;
   });

   it('should return explicit adapter passed via options', () => {
      const dummy = new DummyAdapter();
      const resolved = resolveAiAdapter({ adapter: dummy });
      expect(resolved).toBe(dummy);
   });

   it('should return globally registered adapter when available', () => {
      const dummy = new DummyAdapter();
      Ai.setAdapter(dummy);
      const resolved = resolveAiAdapter();
      expect(resolved).toBe(dummy);
   });

   it('should instantiate GeminiAdapter when apiKey is provided', () => {
      const origEnv = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      try {
         const resolved = resolveAiAdapter({ apiKey: 'fake-test-key-12345' });
         expect(resolved).toBeInstanceOf(GeminiAdapter);
      } finally {
         if (origEnv) {
            process.env.GEMINI_API_KEY = origEnv;
         }
      }
   });

   it('should throw an informative error when no adapter and no apiKey is configured', () => {
      const origEnv = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      try {
         expect(() => resolveAiAdapter({})).toThrow(/No AI adapter configured/i);
      } finally {
         if (origEnv) {
            process.env.GEMINI_API_KEY = origEnv;
         }
      }
   });
});
