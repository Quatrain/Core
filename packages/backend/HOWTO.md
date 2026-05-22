# Quatrain Core - Backend How-To Guide

This guide provides deep, production-grade usage examples of the `@quatrain/backend` package, focusing on persistent collection properties, advanced database aggregation functions (`sum`, `average`, `distinct`, `min`, `max`, `count`), and bulk asynchronous operations using `.apply()`.

---

## 1. Invoice & Billing Management (Facturation)

In this scenario, an `Invoice` has a collection of `InvoiceLine` items. We want to calculate invoice totals, averages, distinct categories, and perform custom tax calculations before persisting updates.

### Model Definitions

First, define the `InvoiceLine` and `Invoice` models:

```typescript
import { PersistedBaseObject, CollectionProperty } from '@quatrain/backend'
import { StringProperty, NumberProperty, ObjectProperty, Core } from '@quatrain/core'

export class InvoiceLine extends PersistedBaseObject {
   static COLLECTION = 'invoice_lines'
   static PROPS_DEFINITION = [
      { name: 'description', type: StringProperty.TYPE },
      { name: 'amount', type: NumberProperty.TYPE },
      { name: 'category', type: StringProperty.TYPE },
      { name: 'invoice', type: ObjectProperty.TYPE, instanceOf: 'Invoice' }
   ]
}

export class Invoice extends PersistedBaseObject {
   static COLLECTION = 'invoices'
   static PROPS_DEFINITION = [
      { name: 'number', type: StringProperty.TYPE },
      { name: 'status', type: StringProperty.TYPE },
      {
         name: 'lines',
         type: CollectionProperty.TYPE,
         instanceOf: InvoiceLine,
         parentKey: 'invoice'
      }
   ]
}

// Register models to allow circular object reference resolutions
Core.addClass('Invoice', Invoice)
Core.addClass('InvoiceLine', InvoiceLine)
```

---

### Use Case A: Querying Database Aggregates Directly (Optimized)

When fetching statistics for a dashboard, loading thousands of lines into memory is inefficient. We can query aggregates natively from the database without hydrating any entities.

```typescript
async function printInvoiceSummary(invoiceId: string) {
   // Load the invoice reference
   const invoice = await Invoice.fromBackend<Invoice>(invoiceId)
   const linesProp = invoice.dataObject.get('lines') as CollectionProperty

   // Ensure the collection is not hydrated (toJSON is undefined)
   console.log(linesProp.toJSON()) // -> undefined

   // 1. Calculate Sum (Total HT)
   const totalHT = await linesProp.sum('amount')
   console.log(`Total HT: ${totalHT} €`)

   // 2. Calculate Average line amount
   const averageLine = await linesProp.average('amount')
   console.log(`Average Line Amount: ${averageLine} €`)

   // 3. Find Distinct categories present in invoice lines
   const categories = await linesProp.distinct('category')
   console.log(`Unique Categories: ${categories.join(', ')}`)

   // 4. Get Min/Max line amounts
   const minAmount = await linesProp.min('amount')
   const maxAmount = await linesProp.max('amount')
   console.log(`Line Ranges: ${minAmount} € - ${maxAmount} €`)

   // 5. Count total items
   const totalLinesCount = await linesProp.count()
   console.log(`Total lines: ${totalLinesCount}`)
}
```

---

### Use Case B: Processing with `.apply()` (Asynchronous Bulk Tasks)

When you need to perform complex business operations on each item of a collection (e.g. applying a discount, adjusting taxes, and calling `.save()` on each line item to ensure validation middleware runs), use the `.apply()` method.

```typescript
async function applyGlobalDiscountAndTax(invoiceId: string, discountPercent: number, taxRate: number) {
   const invoice = await Invoice.fromBackend<Invoice>(invoiceId)
   const linesProp = invoice.dataObject.get('lines') as CollectionProperty

   // .apply() automatically fetches all related lines from the database,
   // hydrades them into InvoiceLine active instances, executes the callback,
   // waits for any asynchronous saving operations to complete, and returns the outcomes.
   const updatedAmounts = await linesProp.apply(async (line: InvoiceLine) => {
      const originalAmount = line.val('amount')
      const discountedAmount = originalAmount * (1 - discountPercent / 100)
      const finalAmount = discountedAmount * (1 + taxRate / 100)

      // Update property
      line.set('amount', parseFloat(finalAmount.toFixed(2)))
      
      // Save item (persists changes to backend)
      await line.save()

      return line.val('amount')
   })

   console.log(`Successfully updated invoice lines. New amounts:`, updatedAmounts)
}
```

---

## 2. Groups & People Management

In this scenario, a `Group` contains multiple `Member` instances. We want to organize members by role, pluck their email addresses for newsletters, and perform bulk membership activations.

### Model Definitions

```typescript
import { PersistedBaseObject, CollectionProperty } from '@quatrain/backend'
import { StringProperty, BooleanProperty, ObjectProperty, Core } from '@quatrain/core'

export class Member extends PersistedBaseObject {
   static COLLECTION = 'members'
   static PROPS_DEFINITION = [
      { name: 'name', type: StringProperty.TYPE },
      { name: 'email', type: StringProperty.TYPE },
      { name: 'role', type: StringProperty.TYPE }, // 'admin' | 'editor' | 'viewer'
      { name: 'isActive', type: BooleanProperty.TYPE },
      { name: 'group', type: ObjectProperty.TYPE, instanceOf: 'Group' }
   ]
}

export class Group extends PersistedBaseObject {
   static COLLECTION = 'groups'
   static PROPS_DEFINITION = [
      { name: 'name', type: StringProperty.TYPE },
      {
         name: 'members',
         type: CollectionProperty.TYPE,
         instanceOf: Member,
         parentKey: 'group'
      }
   ]
}

Core.addClass('Group', Group)
Core.addClass('Member', Member)
```

---

### Use Case A: Analyzing Members (Grouping, Plucking, and Counting)

```typescript
async function inspectGroup(groupId: string) {
   const group = await Group.fromBackend<Group>(groupId)
   const membersProp = group.dataObject.get('members') as CollectionProperty

   // 1. Pluck all email addresses directly (without manual loops)
   const emails = await membersProp.pluck('email')
   console.log(`Emails to notify:`, emails)

   // 2. Count only active members using a predicate callback
   const activeCount = await membersProp.count((m) => m.val('isActive') === true)
   const totalCount = await membersProp.count()
   console.log(`Active members: ${activeCount} / ${totalCount}`)

   // 3. Group members by their role
   const membersByRole = await membersProp.groupBy('role')
   console.log(`Admins:`, membersByRole['admin']?.map(m => m.val('name')) || [])
   console.log(`Editors:`, membersByRole['editor']?.map(m => m.val('name')) || [])
}
```

---

### Use Case B: Asynchronous Bulk Operations with `.apply()`

```typescript
async function activateAllMembersAndAssignRole(groupId: string, newRole: string) {
   const group = await Group.fromBackend<Group>(groupId)
   const membersProp = group.dataObject.get('members') as CollectionProperty

   // Fetch from DB, activate, set role, and delegate saving to the Member object itself
   const activationResults = await membersProp.apply(async (member: Member) => {
      member.set('isActive', true)
      member.set('role', newRole)
      
      // Save the record - this guarantees that validation rules,
      // triggers, and encryption middlewares are fully respected.
      await member.save()

      return {
         name: member.val('name'),
         isActive: member.val('isActive'),
         role: member.val('role')
      }
   })

   console.log(`Bulk activation finished:`, activationResults)
}
```

---

## Best Practices

1. **Let the Database Do the Heavy Lifting**: Use `sum`, `average`, `min`, `max`, and `count` on **non-hydrated** collections. The framework will delegate these operations to your database engine (SQL `SUM`, `AVG`, etc.), saving network bandwidth and memory.
2. **Hydrated Collections**: If you already called `.set()` or fully loaded the collection in-memory, the aggregate and helper methods automatically switch to high-performance local array calculations, keeping your code identical across both modes.
3. **Always `await` results**: All persistent aggregate methods (`sum`, `average`, `distinct`, `min`, `max`, `groupBy`, `pluck`, `count`, `apply`) on the backend `CollectionProperty` return a `Promise`. Do not forget to use `await`.
