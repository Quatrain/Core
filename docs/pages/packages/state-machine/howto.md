# HOWTO - Using the @quatrain/state-machine Package

This guide details how to implement workflow lifecycles and conformance evaluation rules.

---

## 1. Setting up a Workflow (FSM)

Workflow state machines are event-driven and linear. You declare transitions and check results:

```typescript
import { WorkflowStateMachine } from '@quatrain/state-machine';

type States = 'empty' | 'filling' | 'stocked';
type Events = 'FILL' | 'STOCK';
interface Context {
   oxygenLevel: number;
}

const context: Context = { oxygenLevel: 4.5 };
const fsm = new WorkflowStateMachine<States, Events, Context>('empty', context);

// 1. Declare transitions
fsm
   .addTransition('empty', 'FILL', 'filling')
   .addTransition(
      'filling', 
      'STOCK', 
      'stocked',
      // Guard (anonymous function check)
      (ctx) => ctx.oxygenLevel >= 4.0,
      // Action callback
      () => console.log('Bassin has been stocked!')
   );

// 2. Perform transitions
const success = await fsm.transition('FILL'); // true
console.log(fsm.getState()); // 'filling'
```

---

## 2. Setting up a Conformance Evaluator

Conformance machines analyze context attributes continuously to assign status levels:

```typescript
import { ConformanceStateMachine } from '@quatrain/state-machine';

interface Metrics {
   ph: number;
}

const metrics: Metrics = { ph: 7.2 };
const sm = new ConformanceStateMachine<Metrics>('conforming', metrics);

// Declare priority rules (KO check runs first, then degraded, defaulting to conforming)
sm
   .addRule('ko', (ctx) => ctx.ph < 5.5)
   .addRule('degraded', (ctx) => ctx.ph < 6.5 || ctx.ph > 8.5)
   .addRule('conforming', () => true);

// Run evaluation
sm.evaluate(); 
console.log(sm.getState()); // 'conforming'

// Update metric values and re-evaluate
sm.updateContext({ ph: 5.2 });
sm.evaluate();
console.log(sm.getState()); // 'ko'
```
