# How To: Using @quatrain/core

This guide provides practical examples for using the `@quatrain/core` package, covering basic to advanced use cases.

## Table of Contents
1. [Basic Object Creation](#1-basic-object-creation)
2. [Advanced Property Validation](#2-advanced-property-validation)
3. [Managing Object Lifecycles](#3-managing-object-lifecycles)
4. [Using the ObjectURI System](#4-using-the-objecturi-system)
5. [Best Practices](#best-practices)

---

## 1. Basic Object Creation

In Quatrain, any business entity should extend `BaseObject`. This provides property validation, tracking, and serialization.

```typescript
import { 
    BaseObject, 
    StringProperty, 
    NumberProperty,
    BooleanProperty
} from '@quatrain/core'

export class Customer extends BaseObject {
    static COLLECTION = 'customers'
    
    // Define the schema using PROPS_DEFINITION
    static PROPS_DEFINITION = [
        { name: 'firstName', type: StringProperty.TYPE, mandatory: true },
        { name: 'lastName', type: StringProperty.TYPE, mandatory: true },
        { name: 'email', type: StringProperty.TYPE, mandatory: true },
        { name: 'age', type: NumberProperty.TYPE },
        { name: 'isPremium', type: BooleanProperty.TYPE, defaultValue: false }
    ]
}

// Usage Example
async function createCustomer() {
    // Always use the factory() method, never new Customer()
    const customer = await Customer.factory()
    
    // Use the `_` proxy to interact with properties
    customer._.firstName = 'John'
    customer._.lastName = 'Doe'
    customer._.email = 'john.doe@example.com'
    
    // Check if the object passes all property validations
    if (customer.isValid()) {
        console.log('Customer data is valid!')
        console.log(customer.toJSON())
    }
}
```

## 2. Advanced Property Validation

Properties in Quatrain aren't just types; they enforce constraints automatically.

```typescript
import { BaseObject, StringProperty, NumberProperty, ArrayProperty } from '@quatrain/core'

export class Product extends BaseObject {
    static COLLECTION = 'products'
    static PROPS_DEFINITION = [
        { 
            name: 'sku', 
            type: StringProperty.TYPE, 
            mandatory: true,
            // You can restrict maximum length
            length: 12
        },
        { 
            name: 'price', 
            type: NumberProperty.TYPE,
            // You can specify min/max constraints
            min: 0.01,
            max: 10000
        },
        {
            name: 'tags',
            type: ArrayProperty.TYPE,
            // Initialize with empty array instead of null
            defaultValue: []
        }
    ]
}

async function updateProduct(productData: any) {
    const product = await Product.factory()
    
    product._.sku = 'VERY-LONG-SKU-NAME-THAT-WILL-FAIL' // Will throw an error on validation
    product._.price = -5 // Invalid, minimum is 0.01
    
    // You can catch specific property errors
    try {
        product.validate() // Throws if any mandatory or constrained property fails
    } catch (err) {
        console.error("Validation failed:", err.message)
    }
}
```

## 3. Managing Object Lifecycles

Every `BaseObject` includes a built-in `status` property (from the `statuses` enum) which dictates its lifecycle stage.

```typescript
import { BaseObject, statuses } from '@quatrain/core'

async function processOrder() {
    const order = await Order.factory()
    
    // By default, new objects are in 'CREATED' status
    console.log(order.status === statuses.CREATED) // true
    
    // Move to pending
    order.set('status', statuses.PENDING)
    
    // Move to active once processed
    order.set('status', statuses.ACTIVE)
    
    // Soft delete
    order.set('status', statuses.DELETED)
}
```

## 4. Using the ObjectURI System

The `ObjectURI` is a core concept in Quatrain that allows you to uniquely identify any resource across collections and adapters, even without a persistent database.

```typescript
import { ObjectURI } from '@quatrain/core'

// Format: quatrain://[backend]/[collection]/[id]
const uri = new ObjectURI('quatrain://firestore/users/12345')

console.log(uri.backend)    // 'firestore'
console.log(uri.collection) // 'users'
console.log(uri.path)       // '12345'
console.log(uri.fqdn)       // 'quatrain://firestore/users/12345'

// Generate a new unique URI for a specific collection
const newUri = ObjectURI.generate('products')
console.log(newUri.fqdn) // e.g. quatrain://memory/products/a8b9c...
```

## Best Practices

1. **Always use `.factory()`**: Never instantiate a `BaseObject` directly using `new MyClass()`. The `.factory()` method ensures proper initialization of proxies and internal states.
2. **Use the `_` proxy**: While `obj.get('prop')` and `obj.set('prop', val)` work, using the proxy `obj._.prop = val` is cleaner and provides TypeScript auto-completion.
3. **Avoid Persistent Logic**: Keep in mind that `@quatrain/core` runs entirely in memory. If you need objects to interact with a database, your classes must extend `PersistedBaseObject` from the `@quatrain/backend` package instead of `BaseObject`.
