# @quatrain/state-machine

Generic strongly-typed Finite State Machine with anonymous guards and actions.

## Overview

The `@quatrain/state-machine` package provides a declarative engine to model and transition states inside Quatrain applications. It supports two main operational dimensions:

1. **Workflow State Machine (`WorkflowStateMachine`):** Event-driven transitions typically mapping a linear lifecycle (e.g. forward-only progress without backtracking).
2. **Conformance State Machine (`ConformanceStateMachine`):** Rule-driven evaluation that classifies an observed object's status (e.g. `conforming`, `degraded`, or `ko`) by running guard predicates over its data context.

## Key Design Patterns

- **Anonymous Functions:** Guards (predicates) and transition actions are defined inline via anonymous functions.
- **Strict Typing:** Transition states, events, and contexts are generic parameters ensuring full compiler-time safety.
- **Clear Inheritance:** Exposes `BaseStateMachine` properties to support standard extension paths.
