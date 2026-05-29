import { Readable } from 'node:stream'
import { Storage } from './Storage'
import { MockAdapter } from './MockAdapter'
import { Core } from '@quatrain/core'
import { FileType } from './types/FileType'
import fs from 'fs-extra'

// Mock sharp globally to prevent binary dependencies and real image processing.
// Dynamically creates a dummy file at the requested target output path so that
// MockAdapter's read stream won't fail with ENOENT.
jest.mock('sharp', () => {
   const sharpInstance = {
      resize: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      toFile: jest.fn().mockImplementation(async (filePath: string) => {
         await fs.ensureFile(filePath)
         await fs.writeFile(filePath, 'mocked sharp image frame')
         return true
      })
   }
   return jest.fn().mockReturnValue(sharpInstance)
})

describe('Storage Manager', () => {
   let mockAdapter: MockAdapter

   beforeEach(() => {
      mockAdapter = new MockAdapter()

      // Mock Core static system calls to stub CLI execution.
      // Scans arguments for output path ending in .png and writes a dummy frame to it
      // to cleanly satisfy MockAdapter's createReadStream executions without ENOENT errors.
      jest.spyOn(Core, 'getSystemCommandPath').mockResolvedValue('/mocked/path/to/bin')
      jest.spyOn(Core, 'execPromise').mockImplementation(async (cmd: string, args?: any[]) => {
         const outPath = args?.find(arg => typeof arg === 'string' && arg.endsWith('.png'))
         if (outPath) {
            await fs.ensureFile(outPath)
            await fs.writeFile(outPath, 'mocked system CLI video/document frame')
         }
         return true
      })
   })

   afterEach(() => {
      jest.restoreAllMocks()
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
      const file = { bucket: 'test-bucket', ref: 'path/to/file.txt' }

      await Storage.getStorage().create(file, Readable.from(fileData))

      const meta = await mockAdapter.getMetaData(file)
      expect(meta.size).toBe(fileData.length)
   })

   it('should return the URL from the adapter', async () => {
      Storage.addStorage(mockAdapter, 'active', true)
      const url = await Storage.getStorage().getUrl({ bucket: 'test-bucket', ref: 'file.png' })
      expect(url).toBe('https://mock-storage.com/file.png')
   })

   describe('AbstractStorageAdapter Helper Methods', () => {
      it('should resolve file info details correctly', () => {
         const file = { ref: 'bucket/folder/sub/document.PDF' }
         const info = (mockAdapter as any)._getFileInfo(file)
         expect(info).toEqual({
            name: 'bucket/folder/sub/document.PDF',
            bucketDir: 'bucket/folder/sub',
            extension: 'pdf'
         })
      })

      it('should correctly classify supported document extensions and content types', () => {
         const pdfFile: FileType = { bucket: 'test-bucket', ref: 'file.pdf', contentType: 'application/pdf' }
         const xlsxFile: FileType = { bucket: 'test-bucket', ref: 'spread.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
         const textFile: FileType = { bucket: 'test-bucket', ref: 'notes.txt', contentType: 'text/plain' }

         expect((mockAdapter as any)._isDocumentType(pdfFile, 'pdf')).toBe(true)
         expect((mockAdapter as any)._isDocumentType(xlsxFile, 'xlsx')).toBe(true)
         expect((mockAdapter as any)._isDocumentType(textFile, 'txt')).toBe(false)
      })
   })

   describe('Thumbnail Generation Strategies', () => {
      beforeEach(() => {
         // Seed mock files in the in-memory map so that download succeeds
         mockAdapter.getDriver().set('assets/media.png', Buffer.from('mock png data'))
         mockAdapter.getDriver().set('assets/movie.mp4', Buffer.from('mock mp4 data'))
         mockAdapter.getDriver().set('assets/doc.pdf', Buffer.from('mock pdf data'))
      })

      it('should generate image thumbnails using sharp', async () => {
         const file: FileType = {
            bucket: 'test-bucket',
            ref: 'assets/media.png',
            name: 'assets/media.png',
            contentType: 'image/png'
         }

         const result = await mockAdapter.generateThumbnail(file, [150, 300])

         expect(result).toHaveProperty('thumb150')
         expect(result).toHaveProperty('thumb300')
         expect(result.thumb150).toBe('assets/thumb150.png')
         expect(result.thumb300).toBe('assets/thumb300.png')

         // Verify mock file saved
         expect(mockAdapter.getDriver().has('assets/thumb150.png')).toBe(true)
         expect(mockAdapter.getDriver().has('assets/thumb300.png')).toBe(true)
      })

      it('should generate video thumbnails using ffmpeg CLI execution', async () => {
         const file: FileType = {
            bucket: 'test-bucket',
            ref: 'assets/movie.mp4',
            name: 'assets/movie.mp4',
            contentType: 'video/mp4'
         }

         const result = await mockAdapter.generateThumbnail(file, [200])

         expect(Core.getSystemCommandPath).toHaveBeenCalledWith('ffmpeg')
         expect(Core.execPromise).toHaveBeenCalled()
         expect(result).toHaveProperty('thumb200')
         expect(result.thumb200).toBe('assets/thumb200.png')
      })

      it('should generate document thumbnails using magick CLI execution', async () => {
         const file: FileType = {
            bucket: 'test-bucket',
            ref: 'assets/doc.pdf',
            name: 'assets/doc.pdf',
            contentType: 'application/pdf'
         }

         const result = await mockAdapter.generateThumbnail(file, [100])

         expect(Core.getSystemCommandPath).toHaveBeenCalledWith('magick')
         expect(Core.execPromise).toHaveBeenCalled()
         expect(result).toHaveProperty('thumb100')
         expect(result.thumb100).toBe('assets/thumb100.png')
      })

      it('should handle document thumbnails based on fallback extensions', async () => {
         const file: FileType = {
            bucket: 'test-bucket',
            ref: 'assets/doc.pdf',
            name: 'assets/doc.pdf'
            // Missing contentType, but has PDF extension
         }

         const result = await mockAdapter.generateThumbnail(file, [100])

         expect(Core.getSystemCommandPath).toHaveBeenCalledWith('magick')
         expect(result).toHaveProperty('thumb100')
      })

      it('should process possible missed image extensions falling back to application types', async () => {
         mockAdapter.getDriver().set('assets/image.jpg', Buffer.from('mock jpg data'))
         const file: FileType = {
            bucket: 'test-bucket',
            ref: 'assets/image.jpg',
            name: 'assets/image.jpg',
            contentType: 'application/octet-stream'
         }

         const result = await mockAdapter.generateThumbnail(file, [150])
         expect(result).toHaveProperty('thumb150')
         expect(result.thumb150).toBe('assets/thumb150.png')
      })

      it('should bypass unsupported types and return empty mappings gracefully', async () => {
         const file: FileType = {
            bucket: 'test-bucket',
            ref: 'assets/archive.zip',
            name: 'assets/archive.zip',
            contentType: 'application/zip'
         }

         const result = await mockAdapter.generateThumbnail(file, [100])
         expect(result).toEqual({})
      })

      it('should catch failures and return empty objects on thumbnail errors', async () => {
         // Force error by downloading non-existent file
         const file: FileType = {
            bucket: 'test-bucket',
            ref: 'assets/missing.png',
            name: 'assets/missing.png',
            contentType: 'image/png'
         }

         const result = await mockAdapter.generateThumbnail(file, [150])
         expect(result).toEqual({})
      })
   })
})
