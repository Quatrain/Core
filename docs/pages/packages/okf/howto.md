# HOWTO - Using the @quatrain/okf Adapter

This guide presents the most common usage scenarios for the OKF backend storage adapter.

---

## 1. Registering the OKF Adapter

To tell the Quatrain framework to persist models into local JSON files, register the `OKFBackendAdapter` in your application setup:

```typescript
import { Backend } from '@quatrain/backend';
import { OKFBackendAdapter } from '@quatrain/okf';

const okfAdapter = new OKFBackendAdapter({
   config: {
      database: '/path/to/my/data/okf' // Root folder for JSON files
   }
});

// Set as default database backend
Backend.addBackend(okfAdapter, 'default', true);
```

---

## 2. Declaring Models and Saving Data

Define models inheriting from `PersistedBaseObject`:

```typescript
import { PersistedBaseObject } from '@quatrain/backend';
import { StringProperty } from '@quatrain/core';

class Note extends PersistedBaseObject {
   static COLLECTION = 'notes';
   static PROPS_DEFINITION = [
      { name: 'name', type: StringProperty.TYPE }
   ];
}
```

To save files, instantiate your model and save it:

```typescript
const note = await Note.factory();
note.set('name', 'Note 4');
note.set('createdBy', 'user@example.com'); // Written with the record

await note.save(); // Generates /path/to/my/data/okf/notes/{uid}.md
```

---

## 3. Querying Local Files

Use the repository interface to search the flat-file structure:

```typescript
const query = Note.query().filter('name', 'eq', 'Note 4');
const results = await Note.repository().query(query);

results.items.forEach((item) => {
   console.log(item.val('name'));
});
```
