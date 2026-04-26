import { AbstractAiAdapter } from '../AbstractAiAdapter'
import { Ai } from '../Ai'

class MockAiAdapter extends AbstractAiAdapter {
   init() {}
   async generateText(prompt: string) { return 'mock text' }
   async generateStructured(prompt: string, schema: any) { return {} }
}

describe('Ai Singleton', () => {
   it('should throw an error if no adapter is set', () => {
      // @ts-ignore : private property access for test reset
      Ai._adapter = null
      expect(() => Ai.getAdapter()).toThrow()
   })

   it('should set and get the adapter successfully', () => {
      const adapter = new MockAiAdapter()
      Ai.setAdapter(adapter)
      expect(Ai.getAdapter()).toBe(adapter)
   })
})
