import { Backend } from '@quatrain/backend'
import { MockAdapter } from '@quatrain/backend'
import { StudioModel } from './models/StudioModel'
import { StudioProperty } from './models/StudioProperty'
import { CodeGenerator } from './generator'

describe('CodeGenerator', () => {
   beforeAll(() => {
      Backend.addBackend(new MockAdapter(), 'default', true)
   })

   test('should generate model code correctly for persisted model', async () => {
      const model = await StudioModel.factory({
         name: 'Invoice',
         collectionName: 'invoice',
         isPersisted: true,
         version: 2
      })

      const propAmount = await StudioProperty.factory({
         name: 'amount',
         propertyType: 'NumberProperty',
         mandatory: true,
         order: 1
      })

      const propTitle = await StudioProperty.factory({
         name: 'title',
         propertyType: 'StringProperty',
         mandatory: false,
         options: { minLength: 5, maxLength: 100 },
         order: 0
      })

      const code = CodeGenerator.generateModelCode(model, [propAmount, propTitle])
      
      expect(code).toContain("import { PersistedBaseObject } from '@quatrain/backend'")
      expect(code).toContain("export interface InvoiceType extends BaseObjectType")
      expect(code).toContain("amount: number")
      expect(code).toContain("title?: string")
      expect(code).toContain("export const InvoiceProperties: any = [")
      expect(code).toContain("type: NumberProperty.TYPE")
      expect(code).toContain("type: StringProperty.TYPE")
      expect(code).toContain("minLength: 5")
      expect(code).toContain("maxLength: 100")
      expect(code).toContain("export class Invoice extends PersistedBaseObject {")
      expect(code).toContain("static COLLECTION = 'invoice'")
   })

   test('should generate model code correctly for non-persisted model', async () => {
      const model = await StudioModel.factory({
         name: 'SessionData',
         collectionName: 'session_data',
         isPersisted: false,
         version: 1
      })

      const propToken = await StudioProperty.factory({
         name: 'token',
         propertyType: 'StringProperty',
         mandatory: true,
         order: 0
      })

      const code = CodeGenerator.generateModelCode(model, [propToken])

      expect(code).toContain("import { BaseObject } from '@quatrain/core'")
      expect(code).toContain("export class SessionData extends BaseObject {")
   })
})
