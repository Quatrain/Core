import { PersistedBaseObject, UniqueConstraintError } from '@quatrain/backend'
import { BaseObjectProperties, StringProperty } from '@quatrain/core'
import { setup } from './common'

class Space extends PersistedBaseObject {
   static COLLECTION = 'unique_spaces'
   static PROPS_DEFINITION = [
      ...BaseObjectProperties,
      { name: 'slug', type: StringProperty.TYPE, unique: true },
      { name: 'label', type: StringProperty.TYPE },
   ]
}

const adapter = setup()
const space = (values: Record<string, string>) => Space.fromObject({ name: values.slug ?? 'unnamed', ...values } as never).dataObject

afterAll(async () => {
   await adapter.close()
})

describe('SQLite unique properties', () => {
   test('refuses a duplicate on create and on update', async () => {
      await adapter.create(space({ slug: 'acme', label: 'same' }), undefined)
      const globex = await adapter.create(space({ slug: 'globex', label: 'same' }), undefined)

      const duplicate = adapter.create(space({ slug: 'acme' }), undefined)
      await expect(duplicate).rejects.toBeInstanceOf(UniqueConstraintError)
      await expect(duplicate).rejects.toMatchObject({ collection: 'unique_spaces', property: 'slug' })

      globex.set('slug', 'acme')
      await expect(adapter.update(globex)).rejects.toBeInstanceOf(UniqueConstraintError)
   })

   test('lets missing values repeat', async () => {
      await adapter.create(space({ label: 'no slug 1' }), undefined)
      await expect(adapter.create(space({ label: 'no slug 2' }), undefined)).resolves.toBeDefined()
   })

   test('declares the constraint in generated migrations', () => {
      const created = adapter.generateCreateSql('unique_spaces', Space.PROPS_DEFINITION)
      expect(created.upSql).toContain('"slug" TEXT UNIQUE')
      expect(created.upSql).not.toContain('"label" TEXT UNIQUE')
      const delta = adapter.generateDeltaSql('unique_spaces', { added: [{ name: 'code', type: 'StringProperty', unique: true }], removed: [] } as never)
      expect(delta.upSql.join('\n')).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "unique_spaces_code_key"')
   })
})
