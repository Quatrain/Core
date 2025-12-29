import { Readable } from 'stream'
import { AbstractStorageAdapter } from './AbstractStorageAdapter'
import { FileType } from './types/FileType'
import { DownloadFileMetaType } from './types/DownloadFileMetaType'
import fs from 'fs-extra'

export class MockAdapter extends AbstractStorageAdapter {
   private _files = new Map<string, Buffer>()

   getDriver() {
      return this._files
   }

   async create(file: FileType, stream: Readable): Promise<FileType> {
      const chunks: any[] = []
      for await (const chunk of stream) {
         chunks.push(chunk)
      }
      this._files.set(file.ref, Buffer.concat(chunks))
      return file
   }

   async download(file: FileType, path: DownloadFileMetaType): Promise<any> {
      const buffer = this._files.get(file.ref)
      if (!buffer) {
         throw new Error(`File not found: ${file.ref}`)
      }
      await fs.ensureFile(path.path)
      await fs.writeFile(path.path, buffer)
      return path.path
   }

   async copy(file: FileType, destFile: FileType): Promise<any> {
      const buffer = this._files.get(file.ref)
      if (!buffer) {
         throw new Error(`File not found: ${file.ref}`)
      }
      this._files.set(destFile.ref, buffer)
      return true
   }

   async move(file: FileType, destFile: FileType): Promise<any> {
      await this.copy(file, destFile)
      await this.delete(file)
      return true
   }

   async getUrl(file: FileType): Promise<any> {
      return `https://mock-storage.com/${file.ref}`
   }

   async delete(file: FileType): Promise<boolean> {
      return this._files.delete(file.ref)
   }

   async stream(file: FileType, res: any): Promise<any> {
      const buffer = this._files.get(file.ref)
      if (!buffer) {
         throw new Error(`File not found: ${file.ref}`)
      }
      return Readable.from(buffer).pipe(res)
   }

   async getUploadUrl(filePath: FileType): Promise<any> {
      return `https://mock-storage.com/upload/${filePath.ref}`
   }

   async getReadable(file: FileType): Promise<Readable> {
      const buffer = this._files.get(file.ref)
      if (!buffer) {
         throw new Error(`File not found: ${file.ref}`)
      }
      return Readable.from(buffer)
   }

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
}
