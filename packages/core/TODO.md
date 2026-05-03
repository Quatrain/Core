# TODO: Desired UID on Object Creation

- **Goal:** Allow passing a specific `desiredUid` when creating a new object via the high-level API.
- **Context:** The underlying backend adapters (`backend.create(dataObject, desiredUid)`) already support passing a desired unique ID. However, the `DataObject` class (in `@quatrain/core`) and `PersistedBaseObject.save()` (in `@quatrain/backend`) do not currently expose a way to specify this `desiredUid`.
- **Changes required:**
  - Update `DataObject` to accept or store an optional `desiredUid`.
  - Update `PersistedBaseObject.save()` to accept an optional `desiredUid` parameter and pass it down to `Backend.getBackend().create()`.
