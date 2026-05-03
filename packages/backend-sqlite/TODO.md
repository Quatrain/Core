# TODO: Middleware Execution Timing Refactoring

- **Goal:** Support 'before' and 'after' middleware execution timings for SQLite operations.
- **Changes required:**
  - Update all calls to `this.executeMiddlewares(...)` inside `create`, `update`, `delete`, and `read` methods.
  - Split middleware execution into two distinct phases for each action:
    - Call `await this.executeMiddlewares(dataObject, BackendAction.CREATE, 'before', params)` *before* executing the database statement.
    - Call `await this.executeMiddlewares(dataObject, BackendAction.CREATE, 'after', params)` *after* the database statement successfully resolves.
