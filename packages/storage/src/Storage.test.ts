import { Readable } from 'stream'
import { Storage } from './Storage'
import { MockAdapter } from './MockAdapter'

describe('Storage Manager', () => {
   let mockAdapter: MockAdapter

   beforeEach(() => {
      mockAdapter = new MockAdapter()
   })

   it('should register a new storage adapter', () => {
      Storage.addStorage(mockAdapter, 'test-alias')
      expect(Storage.getStorage('test-alias')).toBe(mockAdapter)
   })

   it('should set and retrieve the default adapter', () => {
      Storage.addStorage(mockAdapter, 'default-alias', true)
      expect(Storage.getStorage()).toBe(mockAdapter)
   })

   it('should throw an error when retrieving an unknown adapter', () => {
      expect(() => Storage.getStorage('non-existent')).toThrow(
         "Unknown storage alias: 'non-existent'"
      )
   })

   it('should delegate operations to the registered adapter', async () => {
      Storage.addStorage(mockAdapter, 'active', true)

      const fileData = Buffer.from('hello world')
      const file = { ref: 'path/to/file.txt' }

      await Storage.getStorage().create(file, Readable.from(fileData))

      const meta = await mockAdapter.getMetaData(file)
      expect(meta.size).toBe(fileData.length)
   })

   it('should return the URL from the adapter', async () => {
      Storage.addStorage(mockAdapter, 'active', true)
      const url = await Storage.getStorage().getUrl({ ref: 'file.png' })
      expect(url).toBe('https://mock-storage.com/file.png')
   })
})
