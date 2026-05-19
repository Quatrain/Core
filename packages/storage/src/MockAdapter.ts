import { Readable } from 'node:stream'
import { AbstractStorageAdapter } from './AbstractStorageAdapter'
import { FileType } from './types/FileType'
import { DownloadFileMetaType } from './types/DownloadFileMetaType'
import { BucketStatsType } from './types/BucketStatsType'
import fs from 'fs-extra'

/**
 * A purely in-memory storage adapter designed for unit tests and local mock integrations.
 * Files are temporarily stored in a Node.js `Map<string, Buffer>`.
 */
export class MockAdapter extends AbstractStorageAdapter {
   private _files = new Map<string, Buffer>()

   /**
    * Returns the in-memory Map acting as the driver.
    * 
    * @returns The map containing buffered files.
    */
   getDriver() {
      return this._files
   }

   /**
    * Concatenates the readable stream into a buffer and stores it in memory.
    * 
    * @param file - Target footprint.
    * @param stream - Data stream.
    * @returns A promise resolving to the saved footprint.
    */
   async create(file: FileType, stream: Readable): Promise<FileType> {
      const chunks: any[] = []
      for await (const chunk of stream) {
         chunks.push(chunk)
      }
      this._files.set(file.ref, Buffer.concat(chunks))
      return file
   }

   /**
    * Writes an in-memory buffer to a localized test output directory.
    * 
    * @param file - Target footprint.
    * @param path - Destination metadata.
    * @returns A promise resolving to the physical path written.
    * @throws {Error} If the file doesn't exist in memory.
    */
   async download(file: FileType, path: DownloadFileMetaType): Promise<any> {
      const buffer = this._files.get(file.ref)
      if (!buffer) {
         throw new Error(`File not found: ${file.ref}`)
      }
      await fs.ensureFile(path.path)
      await fs.writeFile(path.path, buffer)
      return path.path
   }

   /**
    * Duplicates a buffer map entry to a new key.
    * 
    * @param file - Source footprint.
    * @param destFile - Target footprint.
    * @returns True upon success.
    */
   async copy(file: FileType, destFile: FileType): Promise<any> {
      const buffer = this._files.get(file.ref)
      if (!buffer) {
         throw new Error(`File not found: ${file.ref}`)
      }
      this._files.set(destFile.ref, buffer)
      return true
   }

   /**
    * Moves a buffer map entry to a new key.
    * 
    * @param file - Source footprint.
    * @param destFile - Target footprint.
    * @returns True upon success.
    */
   async move(file: FileType, destFile: FileType): Promise<any> {
      await this.copy(file, destFile)
      await this.delete(file)
      return true
   }

   /**
    * Returns a mock URL pointing to a fictitious test domain.
    * 
    * @param file - Target footprint.
    * @returns A mock string URL.
    */
   async getUrl(file: FileType): Promise<any> {
      return `https://mock-storage.com/${file.ref}`
   }

   /**
    * Erases the file from the memory map.
    * 
    * @param file - Target footprint.
    * @returns True if an element was removed.
    */
   async delete(file: FileType): Promise<boolean> {
      return this._files.delete(file.ref)
   }

   /**
    * Pipes the buffered memory content directly into an output response.
    * 
    * @param file - Target footprint.
    * @param res - Output writable stream.
    * @throws {Error} If the file is missing from memory.
    */
   async stream(file: FileType, res: any): Promise<any> {
      const buffer = this._files.get(file.ref)
      if (!buffer) {
         throw new Error(`File not found: ${file.ref}`)
      }
      return Readable.from(buffer).pipe(res)
   }

   /**
    * Returns a mock upload endpoint URL.
    * 
    * @param filePath - Target footprint.
    * @returns A mock string upload URL.
    */
   async getUploadUrl(filePath: FileType): Promise<any> {
      return `https://mock-storage.com/upload/${filePath.ref}`
   }

   /**
    * Creates a readable stream from the memory buffer.
    * 
    * @param file - Target footprint.
    * @returns The generated stream.
    * @throws {Error} If the buffer doesn't exist.
    */
   async getReadable(file: FileType): Promise<Readable> {
      const buffer = this._files.get(file.ref)
      if (!buffer) {
         throw new Error(`File not found: ${file.ref}`)
      }
      return Readable.from(buffer)
   }

   /**
    * Extrapolates basic metadata, such as byte size, directly from the buffer.
    * 
    * @param file - Target footprint.
    * @returns The file appended with memory metadata.
    */
   async getMetaData(file: FileType): Promise<FileType> {
      const buffer = this._files.get(file.ref)
      if (!buffer) {
         throw new Error(`File not found: ${file.ref}`)
      }
      return {
         ...file,
         size: buffer.length,
      }
   }

   /**
    * Computes statistics for a given bucket (mock implementation).
    * 
    * @param bucket - Target bucket name.
    * @returns A promise resolving to bucket statistics.
    */
   async getBucketStats(bucket?: string): Promise<BucketStatsType> {
      let totalObjects = 0
      let totalSize = 0
      const folders: Record<string, any> = {}

      for (const [key, buffer] of this._files.entries()) {
         totalObjects++
         totalSize += buffer.length
         
         const parts = key.split('/')
         parts.pop() // remove file name
         const folderPath = parts.length > 0 ? parts.join('/') : '/'
         const folderName = parts.length > 0 ? parts[parts.length - 1] : '/'
         
         const mockDate = new Date()
         if (!folders[folderPath]) {
            folders[folderPath] = { 
               name: folderName,
               path: folderPath,
               totalObjects: 0, 
               totalSize: 0,
               lastModified: mockDate
            }
         }
         folders[folderPath].totalObjects++
         folders[folderPath].totalSize += buffer.length
      }

      return {
         bucket: bucket || 'mock-bucket',
         totalObjects,
         totalSize,
         folders
      }
   }
}
