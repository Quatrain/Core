# TODO: Middleware Execution Timing Refactoring

- **Goal:** Support 'before' and 'after' middleware execution timings for Firestore operations.
- **Changes required:**
  - Update all calls to `this.executeMiddlewares(...)` inside `create`, `update`, `delete`, and `read` methods.
  - Split middleware execution into two distinct phases for each action:
    - Call `await this.executeMiddlewares(dataObject, BackendAction.CREATE, 'before', params)` *before* executing the Firestore document mutation.
    - Call `await this.executeMiddlewares(dataObject, BackendAction.CREATE, 'after', params)` *after* the Firestore document mutation successfully resolves.
