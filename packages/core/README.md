# @quatrain/core

The foundation of the Quatrain framework. This package provides the base components for building business objects and defining data models. It works entirely in-memory and has no persistence dependencies.

## Features

- **Base Objects**: `BaseObject`, `AbstractObject`, `DataObject` for in-memory object management
- **Built-in Models**: `User` and `Entity` models with full property definitions
- **Property System**: Strongly-typed properties with built-in validation
- **Object URI**: A unified resource identification system that works with or without a database
- **Status Management**: Built-in lifecycle statuses (`created`, `pending`, `active`, `deleted`)

## Installation

```bash
npm install @quatrain/core
# or
yarn add @quatrain/core
```

## Quick Start

### Defining a Model

```typescript
import { BaseObject, StringProperty, NumberProperty } from '@quatrain/core'

export class Product extends BaseObject {
   static COLLECTION = 'products'
   static PROPS_DEFINITION = [
      { name: 'name', type: StringProperty.TYPE, mandatory: true },
      { name: 'sku', type: StringProperty.TYPE, mandatory: true },
      { name: 'price', type: NumberProperty.TYPE, defaultValue: 0 },
   ]
}
```

### Creating and Using Objects

```typescript
const product = await Product.factory()
product._.name = 'My Awesome Product'
product._.sku = 'PROD-001'
product._.price = 29.99

console.log(product.isValid()) // true
console.log(product.toJSON()) // { name: 'My Awesome Product', sku: 'PROD-001', price: 29.99 }
```

## Property Types

| Property           | Description                 | Example                   |
| ------------------ | --------------------------- | ------------------------- |
| `StringProperty`   | Text values                 | Names, descriptions, SKUs |
| `NumberProperty`   | Numeric values              | Prices, quantities, ages  |
| `BooleanProperty`  | True/false values           | Flags, toggles            |
| `DateTimeProperty` | Timestamps                  | Created dates, due dates  |
| `EnumProperty`     | Predefined options          | Status, category          |
| `ArrayProperty`    | Lists of values             | Tags, related items       |
| `ObjectProperty`   | References to other objects | Author, parent            |
| `FileProperty`     | File references             | Documents, images         |
| `HashProperty`     | Encrypted values            | Passwords                 |
| `MapProperty`      | Key-value pairs             | Metadata, settings        |

## Object Lifecycle

Objects follow a standard lifecycle with built-in status management:

```
created → pending → active → deleted
```

Access status via `object.status` and update using `object.set('status', statuses.ACTIVE)`.

## Architecture

This package is designed to be the base layer with no external dependencies except logging. For persistence, combine with backend adapters:

- `@quatrain/backend-postgres` - PostgreSQL/Supabase
- `@quatrain/backend-firestore` - Firebase Firestore
- `@quatrain/backend-sqlite` - SQLite

## License

AGPL-3.0-only
