---
type: pattern
title: Core Base Object & Properties
description: Declarative schema definitions, property registration, StringProperty.TYPE constants, and proxy property access in Quatrain Core.
tags:
  - quatrain
  - core
  - domain-modeling
  - schema
  - typescript
timestamp: 2026-09-17T00:00:00.000Z
category: domain-modeling
status: active
---

# Core Base Object & Properties

Quatrain models business domain entities using class definitions extending `BaseObject` (from `@quatrain/core`) and registered into the reflection registry via `Core.addClass()`.

---

## 🎯 Architectural Principles

1. **Explicit Schema Declaration**: Entities declare their static properties in `PROPS_DEFINITION` array using property type constants (`StringProperty.TYPE`, `NumberProperty.TYPE`, `BooleanProperty.TYPE`, etc.).
2. **Access via Methods and Proxy (`._`)**: Properties can be accessed using `.get('key')`, `.val('key')`, mutated using `.set('key', value)`, or directly via the `._` proxy accessor.
3. **Factory Hydration**: Instances are constructed asynchronously using `await ModelClass.factory(data)` or synchronously via `ModelClass.fromObject(data)`.

---

## ⚖️ Implementation Patterns

### ❌ Anti-Pattern: Untyped Dynamic Properties
```typescript
// ❌ BAD: No schema definition, untyped runtime properties, impossible persistence mapping
export class User {
  id: string;
  name: string;
  
  constructor(data: any) {
    this.id = data.id;
    this.name = data.name;
    (this as any).extra = "untracked"; // ❌ Bypasses schema & breaks persistence
  }
}
```

### ✅ Standard Pattern: Quatrain Declarative BaseObject
```typescript
// ✅ GOOD: Registered schema with Quatrain properties, typed proxy, and factory hydration
import {
  BaseObject,
  StringProperty,
  BooleanProperty,
  Core,
} from "@quatrain/core";
import type { DataObjectClass } from "@quatrain/core";

export interface UserProxy {
  email: string;
  fullName: string;
  isActive: boolean;
}

export class User extends BaseObject {
  static COLLECTION = "users";

  static PROPS_DEFINITION = [
    {
      name: "email",
      type: StringProperty.TYPE,
      required: true,
    },
    {
      name: "fullName",
      type: StringProperty.TYPE,
      required: true,
      default: "",
    },
    {
      name: "isActive",
      type: BooleanProperty.TYPE,
      default: true,
    },
  ];

  declare _: UserProxy;

  constructor(dao: DataObjectClass<any>) {
    super(dao);
  }
}

// Register class in Quatrain Core reflection registry
Core.addClass("User", User);
```

---

## 💡 Instantiation & Access Example

```typescript
// Asynchronous hydration via factory
const user = await User.factory({
  name: "usr_1029",
  email: "developer@quatrain.dev",
  fullName: "Alice Vance",
  isActive: true,
});

// Property value access via .val() or proxy ._
console.log(user.val("fullName")); // "Alice Vance"
console.log(user._.fullName);      // "Alice Vance"

// Mutation via .set() or proxy
user.set("fullName", "Alice Smith");
user._.isActive = false;

// Canonical URI and JSON serialization
console.log(user.path); // "users/usr_1029"
const payload = user.toJSON();
```
