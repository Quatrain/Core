# TODO: Middleware Execution Timing Refactoring

- **Goal:** Allow middlewares to explicitly declare if they run BEFORE or AFTER a database action. Currently, `executeMiddlewares` runs all middlewares right before the `INSERT`/`UPDATE`/`DELETE` operation.
- **Changes required:**
  - Update `BackendMiddleware` interface in `src/middlewares/Middleware.ts` to support optional `beforeExecute()` and `afterExecute()` methods instead of (or in addition to) the legacy `execute()`.
  - Update `AbstractBackendAdapter.ts` `executeMiddlewares` method to take an additional `timing: 'before' | 'after'` argument.
  - Refactor existing core middlewares (like `InjectMetaMiddleware`) to implement `beforeExecute()`.

# TODO: Desired UID on Object Creation

- **Goal:** Expose the `desiredUid` capability in `PersistedBaseObject.save()`.
- **Context:** `backend.create()` supports `desiredUid`, but it's currently unreachable from the higher-level models.
- **Changes required:** Update `PersistedBaseObject.save(desiredUid?: string)` to pass the argument down to `this.getBackend().create(this._dataObject, desiredUid)`.
