# HOWTO - Using the @quatrain/state-machine Package

This guide details how to implement workflow lifecycles and conformance evaluation rules.

---

## 1. Setting up a Workflow (FSM)

Workflow state machines are event-driven and linear. You declare transitions and check results:

```typescript
import { WorkflowStateMachine } from '@quatrain/state-machine';

type States = 'draft' | 'paid' | 'shipped';
type Events = 'PAY' | 'SHIP';
interface Context {
   itemsInStock: number;
}

const context: Context = { itemsInStock: 3 };
const fsm = new WorkflowStateMachine<States, Events, Context>('draft', context);

// 1. Declare transitions
fsm
   .addTransition('draft', 'PAY', 'paid')
   .addTransition(
      'paid', 
      'SHIP', 
      'shipped',
      // Guard (anonymous function check)
      (ctx) => ctx.itemsInStock > 0,
      // Action callback
      () => console.log('Order has been shipped!')
   );

// 2. Perform transitions
const success = await fsm.transition('PAY'); // true
console.log(fsm.getState()); // 'paid'
```

---

## 2. Setting up a Conformance Evaluator

Conformance machines analyze context attributes continuously to assign status levels:

```typescript
import { ConformanceStateMachine } from '@quatrain/state-machine';

interface Metrics {
   latencyMs: number;
}

const metrics: Metrics = { latencyMs: 120 };
const sm = new ConformanceStateMachine<Metrics>('conforming', metrics);

// Declare priority rules (KO check runs first, then degraded, defaulting to conforming)
sm
   .addRule('ko', (ctx) => ctx.latencyMs > 2000)
   .addRule('degraded', (ctx) => ctx.latencyMs > 500)
   .addRule('conforming', () => true);

// Run evaluation
sm.evaluate(); 
console.log(sm.getState()); // 'conforming'

// Update metric values and re-evaluate
sm.updateContext({ latencyMs: 2500 });
sm.evaluate();
console.log(sm.getState()); // 'ko'
```
