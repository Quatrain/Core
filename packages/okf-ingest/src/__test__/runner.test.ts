import { describe, expect, it } from '@jest/globals';
import { GeminiStructuredRunner, resolveStructuredRunner } from '../runner';
import { AiStructuredRunner } from '../types';

describe('GeminiStructuredRunner & resolveStructuredRunner', () => {
   it('should throw if no apiKey is provided to GeminiStructuredRunner', () => {
      expect(() => new GeminiStructuredRunner({ apiKey: '' })).toThrow(/API key is required/i);
   });

   it('should instantiate runner and resolve correctly with apiKey', () => {
      const runner = new GeminiStructuredRunner({ apiKey: 'fake-test-key', defaultModel: 'gemini-2.5-flash' });
      expect(runner).toBeDefined();

      const resolved = resolveStructuredRunner('fake-test-key');
      expect(resolved).toBeInstanceOf(GeminiStructuredRunner);
   });

   it('should return custom runner if provided to resolveStructuredRunner', () => {
      const dummyRunner: AiStructuredRunner = {
         generateStructured: async () => ({
            data: {},
            usage: { prompt: 10, candidates: 10, total: 20, costUsd: 0 },
            rawText: '{}',
         }),
         generateStructuredMultimodal: async () => ({
            data: {},
            usage: { prompt: 10, candidates: 10, total: 20, costUsd: 0 },
            rawText: '{}',
         }),
      };

      const resolved = resolveStructuredRunner(undefined, dummyRunner);
      expect(resolved).toBe(dummyRunner);
   });

   it('should throw when no runner and no apiKey can be resolved', () => {
      const origKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      try {
         expect(() => resolveStructuredRunner()).toThrow(/An AiStructuredRunner or an API key/i);
      } finally {
         if (origKey) {
            process.env.GEMINI_API_KEY = origKey;
         }
      }
   });

   it('should run structured generation using underlying adapter mock', async () => {
      const runner = new GeminiStructuredRunner({ apiKey: 'fake-key' });
      // Mock internal adapter generateStructured
      // @ts-expect-error accessing private adapter for unit test stub
      runner.adapter.generateStructured = async () => ({
         title: 'Test Response',
         score: 42,
      });

      const response = await runner.generateStructured<{ title: string; score: number }>(
         'Test prompt',
         { type: 'OBJECT' }
      );

      expect(response.data.title).toBe('Test Response');
      expect(response.data.score).toBe(42);
      expect(response.usage.prompt).toBeGreaterThan(0);
   });

   it('should run multimodal structured generation using underlying adapter mock', async () => {
      const runner = new GeminiStructuredRunner({ apiKey: 'fake-key' });
      // @ts-expect-error accessing private adapter for unit test stub
      runner.adapter.generateStructured = async () => ({
         caption: 'A picture of a field',
      });

      const response = await runner.generateStructuredMultimodal<{ caption: string }>(
         'Describe this image',
         [{ mimeType: 'image/jpeg', data: 'base64data' }],
         { type: 'OBJECT' }
      );

      expect(response.data.caption).toBe('A picture of a field');
      expect(response.usage.prompt).toBeGreaterThan(0);
   });
});
