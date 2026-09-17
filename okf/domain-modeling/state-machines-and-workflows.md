---
type: pattern
title: State Machines & Workflows
description: Deterministic lifecycle state management using WorkflowStateMachine from @quatrain/state-machine.
tags:
  - quatrain
  - state-machine
  - workflows
  - fsm
  - domain-modeling
timestamp: 2026-09-17T00:00:00.000Z
category: domain-modeling
status: active
---

# State Machines & Workflows

Quatrain provides deterministic finite state machine abstractions via `@quatrain/state-machine`. Rather than managing status mutations through loose string manipulation, entities use `WorkflowStateMachine` with typed states, events, guards, and transition actions.

---

## 🎯 Architectural Principles

1. **Explicit States & Events**: States and triggering events are declared as strict union types.
2. **Transition Rules & Guards**: Transitions are registered via `addTransition(from, event, to, guard?, action?)`. If the guard predicate fails, the state does not change.
3. **Traceability**: `fsm.getHistory()` preserves the full chronological trajectory of state changes.

---

## ⚖️ Implementation Patterns

### ❌ Anti-Pattern: Ad-Hoc String Checks & Direct Mutation
```typescript
// ❌ BAD: Fragile conditional logic scattered throughout controllers without history or guards
function approveOrder(order: any) {
  if (order.status === "draft") {
    order.status = "approved"; // ❌ No guard, no history, no transition check
  } else if (order.status === "cancelled") {
    throw new Error("Cannot approve cancelled order");
  }
}
```

### ✅ Standard Pattern: Quatrain WorkflowStateMachine
```typescript
// ✅ GOOD: Strong state & event typing, explicit transition table with guards and actions
import { WorkflowStateMachine } from "@quatrain/state-machine";

type OrderState = "draft" | "submitted" | "approved" | "rejected";
type OrderEvent = "SUBMIT" | "APPROVE" | "REJECT";

interface OrderContext {
  orderId: string;
  totalAmount: number;
  approverEmail?: string;
}

const context: OrderContext = {
  orderId: "ord_9901",
  totalAmount: 450,
};

// Initialize workflow state machine in 'draft' state
const fsm = new WorkflowStateMachine<OrderState, OrderEvent, OrderContext>("draft", context);

// 1. Transition: draft -> submitted
fsm.addTransition(
  "draft",
  "SUBMIT",
  "submitted",
  (ctx) => ctx.totalAmount > 0 // Guard: must have positive amount
);

// 2. Transition: submitted -> approved
fsm.addTransition(
  "submitted",
  "APPROVE",
  "approved",
  (ctx) => ctx.approverEmail !== undefined, // Guard: approver must be set
  async (ctx) => {
    // Action callback executed upon successful transition
    console.log(`Order ${ctx.orderId} approved by ${ctx.approverEmail}`);
  }
);

// Execute transitions:
const submitted = await fsm.transition("SUBMIT");
console.log(submitted); // true
console.log(fsm.currentState); // "submitted"

// Attempt approval without approver set (guard fails)
const approvedFail = await fsm.transition("APPROVE");
console.log(approvedFail); // false (guard prevented transition)

// Set approver and retry
context.approverEmail = "manager@quatrain.dev";
const approvedSuccess = await fsm.transition("APPROVE");
console.log(approvedSuccess); // true
console.log(fsm.currentState); // "approved"
console.log(fsm.getHistory()); // ["draft", "submitted", "approved"]
```
