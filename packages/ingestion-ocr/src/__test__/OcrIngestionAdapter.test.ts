import { AbstractAiAdapter, Ai, type AiUsageInterface } from '@quatrain/ai'
import { OcrIngestionAdapter } from '../index'

const RESULT = {
   title: 'Getting started guide',
   type: 'guide',
   summary: 'How to start.',
   category: 'guides',
   tags: ['onboarding'],
   properNouns: [],
   markdown: '# Getting started',
}

class RecordingAdapter extends AbstractAiAdapter {
   public calls: any[] = []

   init(): void {}

   async generateText(): Promise<string> {
      return ''
   }

   async generateStructured(_prompt: any, _schema: any, options?: any): Promise<any> {
      this.calls.push(options)
      options?.onUsage?.({ promptTokenCount: 12, candidatesTokenCount: 30, totalTokenCount: 42 })
      return RESULT
   }
}

describe('OcrIngestionAdapter', () => {
   it('uses the adapter given for the call instead of the process-wide one', async () => {
      const shared = new RecordingAdapter()
      const own = new RecordingAdapter()
      Ai.setAdapter(shared)

      const result = await new OcrIngestionAdapter().process('Some text', { isText: true, ai: own, model: 'model-a' })

      expect(result).toEqual(RESULT)
      expect(own.calls).toHaveLength(1)
      expect(own.calls[0].model).toBe('model-a')
      expect(shared.calls).toHaveLength(0)
   })

   it('falls back to the process-wide adapter', async () => {
      const shared = new RecordingAdapter()
      Ai.setAdapter(shared)

      await new OcrIngestionAdapter().process('Some text', { isText: true })

      expect(shared.calls).toHaveLength(1)
   })

   it('reports the token usage of the model call', async () => {
      const usages: AiUsageInterface[] = []

      await new OcrIngestionAdapter().process('Some text', {
         isText: true,
         ai: new RecordingAdapter(),
         onUsage: (usage: AiUsageInterface) => usages.push(usage),
      })

      expect(usages).toEqual([{ promptTokenCount: 12, candidatesTokenCount: 30, totalTokenCount: 42 }])
   })
})
