# Quatrain Core - Gemini Agent Guidelines & Workflow Rules

This document serves as the dedicated instruction and compliance guidelines specifically tailored for the Gemini AI Coding Agent.

**When working on this repository, you MUST adhere to the following rules and best practices.**

---

## 1. Architectural Standards

Always refer to [AGENTS.md](file:///Users/crapougnax/CODE/QUATRAIN/Core/AGENTS.md) for full architectural guidelines. Key elements include:
* **Instantiation**: Use `PersistedBaseObject.fromBackend(id)` for existing database loads, and `.factory(data)` for new instances.
* **Property definitions**: Always use imported typed static definitions (like `BooleanProperty.TYPE`) in `PROPS_DEFINITION`, never raw string literals.
* **Logging**: `Backend.log` is deprecated. Use `Backend.debug`, `Backend.info`, `Backend.warn`, or `Backend.error` in **International English**.
* **Protected Encapsulation**: Prefer `protected` over `private` to support class inheritance unless explicitly marked as `final`.

---

## 2. SonarQube & Code Quality Compliance Rules

To keep the codebase clean, stable, and compliant with modern static code analyzers, systematically apply the following rules:

### A. Number Utilities & Strict Casting
* **Prefer `Number.parseInt` over `parseInt`**: Global `parseInt` has implicit parsing rules. Always use `Number.parseInt(value, 10)` to explicitly specify the radix and avoid parser mismatch.
* **Prefer `Number.isNaN` over `isNaN`**: Global `isNaN` implicitly coerces non-number types (e.g. `isNaN('abc')` is `true`). Always use `Number.isNaN` to strictly check for `NaN` values without coercion.

### B. Interactive Elements & HTML5 Accessibility (typescript:S6848)
* **Interactive handlers on non-interactive elements**: Non-interactive elements (e.g., `<div>`, `<span>`, `<p>`, `<td>`) should never have interactive event handlers like `onClick` or `onKeyDown`.
* **The Solution**: 
  1. Prefer native interactive HTML elements (e.g. `<button>`, `<a>`, `<input>`).
  2. If using native HTML is not possible, add an appropriate WAI-ARIA `role` (e.g. `role="button"`), a valid `tabIndex={0}`, and ensure support for tabbing, mouse, keyboard, and touch inputs.

### C. Default Parameters & Object Literals (typescript:S7737)
* **Objects as Default Parameters**: Never use object literals directly as default parameters in function or method signatures (e.g. `params: object = {}`).
* **Why**: An empty object literal created as a default parameter instantiates a new object reference on *every* call, causing memory overhead, unnecessary garbage collection, and breaking React memoization.
* **The Solution**: Make the parameter optional (e.g. `params?: object` or default to `undefined`) and initialize the fallback object inside the function body:
  ```typescript
  // ✅ GOOD:
  public async get(endpoint: string, params?: QueryOptions) {
     const actualParams = params || {}
     // ...
  }
  
  // ❌ BAD:
  public async get(endpoint: string, params: QueryOptions = {}) {
     // ...
  }
  ```

---

## 3. Workflow Commitments
* **Zero TypeScript Errors Policy**: A task is never complete until `yarn build` succeeds with zero warnings or errors.
* **JSDoc Documentation**: Systematically write complete, clean JSDoc comments for all new classes, functions, and methods.
* **Co-locate Unit Tests**: Keep unit tests next to implementation files inside `src/`. Ensure they are excluded from production NPM registry bundles via `.npmignore`.
