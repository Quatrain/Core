import { PersistedBaseObject } from './PersistedBaseObject'
import { Backend } from './Backend'
import { MockAdapter } from './MockAdapter'
import { CollectionProperty } from './CollectionProperty'
import { ObjectProperty, StringProperty, NumberProperty, Core, ObjectUri } from '@quatrain/core'
import { Query } from './Query'

class TestInvoiceLine extends PersistedBaseObject {
   static COLLECTION = 'invoice_lines'
   static PROPS_DEFINITION = [
      { name: 'description', type: StringProperty.TYPE },
      { name: 'amount', type: NumberProperty.TYPE },
      { name: 'invoice', type: ObjectProperty.TYPE, instanceOf: 'TestInvoice' },
   ]
}

class TestInvoice extends PersistedBaseObject {
   static COLLECTION = 'invoices'
   static PROPS_DEFINITION = [
      { name: 'number', type: StringProperty.TYPE },
      {
         name: 'lines',
         type: CollectionProperty.TYPE,
         instanceOf: TestInvoiceLine,
         parentKey: 'invoice',
      },
   ]
}

// Register classes in Core class registry for string resolution
Core.addClass('TestInvoice', TestInvoice)
Core.addClass('TestInvoiceLine', TestInvoiceLine)

describe('Backend CollectionProperty (Persistent)', () => {
   beforeAll(() => {
      Backend.addBackend(new MockAdapter(), 'default', true)
   })

   it('should instantiate correctly and build the relational query', async () => {
      const invoice = await TestInvoice.factory()
      const linesProp = invoice.dataObject.get('lines') as CollectionProperty
      expect(linesProp).toBeDefined()
      expect(linesProp.constructor.name).toBe('CollectionProperty')

      const query = linesProp.get()
      expect(query).toBeInstanceOf(Query)
      expect(query.obj).toBe(TestInvoiceLine)

      // The query should filter by the parent key pointing to the parent uri
      const filter = query.filters[0]
      expect(filter).toBeDefined()
      expect(filter.prop).toBe('invoice')
      expect(filter.value).toBe(invoice.uri)
      expect(filter.operator).toBe('equals')
   })

   it('should allow manually setting and getting values', async () => {
      const invoice = await TestInvoice.factory()
      const linesProp = invoice.dataObject.get('lines') as CollectionProperty

      const line1 = await TestInvoiceLine.factory()
      const line2 = await TestInvoiceLine.factory()

      linesProp.set([line1, line2])
      expect(linesProp.toJSON()).toEqual([line1, line2])
   })

    it('should correctly execute composite methods on model collections', async () => {
       const invoice = await TestInvoice.factory()
       const linesProp = invoice.dataObject.get('lines') as CollectionProperty
 
       const line1 = await TestInvoiceLine.factory()
       line1.set('amount', 150)
       line1.set('description', 'Item A')
 
       const line2 = await TestInvoiceLine.factory()
       line2.set('amount', 350)
       line2.set('description', 'Item B')
 
       const line3 = await TestInvoiceLine.factory()
       line3.set('amount', 100)
       line3.set('description', 'Item A')
 
       linesProp.set([line1, line2, line3])
 
       // sum
       expect(await linesProp.sum('amount')).toBe(600)
 
       // average
       expect(await linesProp.average('amount')).toBe(200)
 
       // distinct
       const distinctVal = await linesProp.distinct('description')
       expect(distinctVal.sort()).toEqual(['Item A', 'Item B'])
 
       // min / max
       expect(await linesProp.min('amount')).toBe(100)
       expect(await linesProp.max('amount')).toBe(350)
 
       // groupBy
       const grouped = await linesProp.groupBy('description')
       expect(grouped['Item A'].length).toBe(2)
       expect(grouped['Item B'].length).toBe(1)
 
       // pluck
       expect(await linesProp.pluck('amount')).toEqual([150, 350, 100])
 
       // count
       expect(await linesProp.count()).toBe(3)
       expect(await linesProp.count((line) => line.val('amount') > 120)).toBe(2)

       // apply
       const applyResult = await linesProp.apply((line) => line.val('amount') * 2)
       expect(applyResult).toEqual([300, 700, 200])
    })

    it('should correctly query aggregates from the database for non-hydrated collections', async () => {
       const invoice = await TestInvoice.factory()
       invoice.dataObject.uri = new ObjectUri('invoices/inv-123')
 
       // Inject mock invoice lines in MockAdapter fixtures
       const line1Data = {
          description: 'Item A',
          amount: 100,
          invoice: 'invoices/inv-123',
          path: 'invoice_lines/line-1',
          uid: 'line-1',
       }
       const line2Data = {
          description: 'Item B',
          amount: 200,
          invoice: 'invoices/inv-123',
          path: 'invoice_lines/line-2',
          uid: 'line-2',
       }
       const line3Data = {
          description: 'Item A',
          amount: 300,
          invoice: 'invoices/inv-123',
          path: 'invoice_lines/line-3',
          uid: 'line-3',
       }
 
       MockAdapter.inject(line1Data)
       MockAdapter.inject(line2Data)
       MockAdapter.inject(line3Data)
 
       const linesProp = invoice.dataObject.get('lines') as CollectionProperty
       // Ensure linesProp is NOT hydrated
       expect(linesProp.toJSON()).toBeUndefined()
 
       // sum
       expect(await linesProp.sum('amount')).toBe(600)
 
       // average
       expect(await linesProp.average('amount')).toBe(200)
 
       // distinct
       const distinct = await linesProp.distinct('description')
       expect(distinct.sort()).toEqual(['Item A', 'Item B'])
 
       // min / max
       expect(await linesProp.min('amount')).toBe(100)
       expect(await linesProp.max('amount')).toBe(300)
 
       // groupBy
       const grouped = await linesProp.groupBy('description')
       expect(grouped['Item A'].length).toBe(2)
       expect(grouped['Item B'].length).toBe(1)
 
       // pluck
       const plucked = await linesProp.pluck('amount')
       expect(plucked.sort()).toEqual([100, 200, 300])
 
       // count
       expect(await linesProp.count()).toBe(3)
       expect(await linesProp.count((line) => line.val('amount') > 150)).toBe(2)
 
       // apply (asynchronous save/update test)
       const applyResult = await linesProp.apply(async (line) => {
          line.set('description', `${line.val('description')} - Modified`)
          await line.save()
          return line.val('description')
       })
 
       expect(applyResult.sort()).toEqual(['Item A - Modified', 'Item A - Modified', 'Item B - Modified'])
 
       // Verify that fixtures were updated in the database
       const dbLine1 = MockAdapter.getFixture('invoice_lines/line-1')
       expect(dbLine1.description).toBe('Item A - Modified')
    })
})
