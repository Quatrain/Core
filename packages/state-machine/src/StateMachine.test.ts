import { WorkflowStateMachine, ConformanceStateMachine } from './StateMachine';

interface TestContext {
   value: number;
   message?: string;
}

describe('WorkflowStateMachine', () => {
   test('should progress from state to state when events match', async () => {
      const ctx: TestContext = { value: 10 };
      const fsm = new WorkflowStateMachine<'init' | 'step1' | 'step2', 'NEXT' | 'FINISH', TestContext>('init', ctx);

      fsm.addTransition('init', 'NEXT', 'step1');
      fsm.addTransition('step1', 'FINISH', 'step2');

      expect(fsm.getState()).toBe('init');
      
      const res1 = await fsm.transition('NEXT');
      expect(res1).toBe(true);
      expect(fsm.getState()).toBe('step1');

      const res2 = await fsm.transition('FINISH');
      expect(res2).toBe(true);
      expect(fsm.getState()).toBe('step2');
      expect(fsm.getHistory()).toEqual(['init', 'step1', 'step2']);
   });

   test('should block transition when guard returns false', async () => {
      const ctx: TestContext = { value: 5 };
      const fsm = new WorkflowStateMachine<'init' | 'success', 'GO', TestContext>('init', ctx);

      fsm.addTransition('init', 'GO', 'success', (c) => c.value > 10);

      const res = await fsm.transition('GO');
      expect(res).toBe(false);
      expect(fsm.getState()).toBe('init');

      fsm.updateContext({ value: 15 });
      const res2 = await fsm.transition('GO');
      expect(res2).toBe(true);
      expect(fsm.getState()).toBe('success');
   });

   test('should execute action callback during transition', async () => {
      const ctx: TestContext = { value: 1 };
      const fsm = new WorkflowStateMachine<'a' | 'b', 'MOVE', TestContext>('a', ctx);

      fsm.addTransition('a', 'MOVE', 'b', undefined, (c) => {
         c.value = 42;
         c.message = 'updated';
      });

      await fsm.transition('MOVE');
      expect(fsm.getState()).toBe('b');
      expect(ctx.value).toBe(42);
      expect(ctx.message).toBe('updated');
   });
});

describe('ConformanceStateMachine', () => {
   test('should evaluate context dynamically and transition states', () => {
      const ctx: TestContext = { value: 100 };
      const sm = new ConformanceStateMachine<TestContext>('conforming', ctx);

      sm.addRule('ko', (c) => c.value < 50)
        .addRule('degraded', (c) => c.value >= 50 && c.value < 80);

      expect(sm.getState()).toBe('conforming');

      // Update to warning range
      sm.updateContext({ value: 70 });
      let changed = sm.evaluate();
      expect(changed).toBe(true);
      expect(sm.getState()).toBe('degraded');

      // Update to critical range
      sm.updateContext({ value: 30 });
      changed = sm.evaluate();
      expect(changed).toBe(true);
      expect(sm.getState()).toBe('ko');

      // Recover
      sm.updateContext({ value: 90 });
      changed = sm.evaluate();
      expect(changed).toBe(true);
      expect(sm.getState()).toBe('conforming');
   });
});
