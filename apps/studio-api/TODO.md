# TODO: Middleware Execution Timing Refactoring

- **Goal:** Move `HistoryMiddleware` execution to happen *after* successful database changes, preventing phantom history records on failed saves.
- **Changes required:**
  - Refactor `src/middlewares/HistoryMiddleware.ts` to implement the new `afterExecute` method from the updated `BackendMiddleware` interface.
  - This ensures that history logs are only generated when the database operation actually succeeds, rather than before the `INSERT` or `UPDATE` happens.
