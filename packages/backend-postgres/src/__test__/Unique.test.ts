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

const backend = setup()
const space = (values: Record<string, string>) => Space.fromObject({ name: values.slug ?? 'unnamed', ...values } as never).dataObject

beforeAll(async () => {
   await backend.rawQuery('DROP TABLE IF EXISTS unique_spaces')
})

afterAll(async () => {
   await backend.rawQuery('DROP TABLE IF EXISTS unique_spaces')
})

describe('Postgres unique properties', () => {
   test('refuses a duplicate on create and on update', async () => {
      await backend.create(space({ slug: 'acme', label: 'same' }), undefined)
      const globex = await backend.create(space({ slug: 'globex', label: 'same' }), undefined)

      const duplicate = backend.create(space({ slug: 'acme' }), undefined)
      await expect(duplicate).rejects.toBeInstanceOf(UniqueConstraintError)
      await expect(duplicate).rejects.toMatchObject({ collection: 'unique_spaces', property: 'slug' })

      globex.set('slug', 'acme')
      await expect(backend.update(globex)).rejects.toBeInstanceOf(UniqueConstraintError)
   })

   test('refuses concurrent creations of the same value but one', async () => {
      const attempts = await Promise.allSettled(Array.from({ length: 8 }, () => backend.create(space({ slug: 'raced' }), undefined)))
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1)
      for (const attempt of attempts) {
         if (attempt.status === 'rejected') {
            expect(attempt.reason).toBeInstanceOf(UniqueConstraintError)
         }
      }
   })

   test('reports a record identifier already taken the same way', async () => {
      await backend.create(space({ slug: 'first-id' }), 'fixed-id')
      const duplicate = backend.create(space({ slug: 'second-id' }), 'fixed-id')
      await expect(duplicate).rejects.toBeInstanceOf(UniqueConstraintError)
      await expect(duplicate).rejects.toMatchObject({ collection: 'unique_spaces', property: undefined })
   })

   test('lets missing values repeat', async () => {
      await backend.create(space({ label: 'no slug 1' }), undefined)
      await expect(backend.create(space({ label: 'no slug 2' }), undefined)).resolves.toBeDefined()
   })

   test('declares the constraint in generated migrations', () => {
      expect(backend.generateCreateSql('unique_spaces', Space.PROPS_DEFINITION).upSql).toContain('"slug" TEXT UNIQUE')
      const delta = backend.generateDeltaSql('unique_spaces', { added: [{ name: 'code', type: 'StringProperty', unique: true }], removed: [] } as never)
      expect(delta.upSql[0]).toContain('ADD COLUMN "code" TEXT UNIQUE')
   })
})
