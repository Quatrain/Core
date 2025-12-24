import {
   Storage,
   AbstractStorageAdapter,
   FileType,
   FileResponseLinkType,
   StorageParameters,
   DownloadFileMetaType,
} from '@quatrain/storage'
import { Readable, Stream } from 'stream'
import { StorageClient } from '@supabase/storage-js'
import { tmpdir } from 'os'
import { join } from 'path'
import fs from 'node:fs'

export class SupabaseStorageAdapter extends AbstractStorageAdapter {
   protected _client: StorageClient

   constructor(params: StorageParameters) {
      super(params)
      this._client = new StorageClient(params.config.endpoint, {
         apikey: params.config.secret,
         Authorization: `Bearer ${params.config.secret}`,
      })

      Storage.info(`[SSA] Supabase Storage Adapter initialized`)
   }

   getDriver() {
      return this._client
   }

   getMetaData(file: FileType): Promise<FileType> {
      return new Promise(() => file)
   }

   async test(): Promise<boolean> {
      try {
         const { data, error } = await this._client.listBuckets()

         if (error !== null) {
            Storage.error(`Unable to get buckets list`)
            throw new Error(`Unable to get buckets list: ${error.message}`)
         }

         // Storage.info(`S3 Buckets: ${JSON.stringify(data)}`)

         return true
      } catch (err) {
         Storage.error(
            `Failed to connect to storage: ${(err as Error).message}`
         )
         return false
      }
   }

   async streamToBuffer(stream: Stream): Promise<Buffer> {
      return new Promise<Buffer>((resolve, reject) => {
         const _buf: any[] = []

         stream.on('data', (chunk) => _buf.push(chunk))
         stream.on('end', () => resolve(Buffer.concat(_buf)))
         stream.on('error', (err) => reject(err))
      })
   }

   toArrayBuffer(buffer: Buffer): ArrayBuffer {
      const arrayBuffer = new ArrayBuffer(buffer.length)
      const view = new Uint8Array(arrayBuffer)
      for (let i = 0; i < buffer.length; ++i) {
         view[i] = buffer[i]
      }
      return arrayBuffer
   }

   async create(file: FileType, stream: Readable | string): Promise<FileType> {
      Storage.info(`[SSA] Uploading ${file.ref} to ${file.bucket}`)

      if (typeof stream === 'string') {
         const { error } = await this._client
            .from(file.bucket)
            .upload(file.ref, new Blob([fs.readFileSync(stream)]), {
               upsert: true,
               contentType: file.contentType,
            })
         if (error !== null) {
            Storage.error(error)
            Storage.error(`Unable to upload ${file.ref} to ${file.bucket}`)
            throw new Error(`Unable to upload ${file.ref} to ${file.bucket}`)
         }
      } else {
         const content = new Blob([
            this.toArrayBuffer(await this.streamToBuffer(stream)),
         ])
         const { error } = await this._client
            .from(file.bucket)
            .upload(file.ref, content, {
               //   cacheControl: '3600',
               upsert: false,
               contentType: file.contentType,
            })
         if (error !== null) {
            console.log(error)
            Storage.error(`Unable to upload ${file.ref} to ${file.bucket}`)
            throw new Error(`Unable to upload ${file.ref} to ${file.bucket}`)
         }
      }

      return file
   }

   async copy(file: FileType, destFile: FileType) {
      try {
         const response = await this._client
            .from(file.bucket)
            .copy(file.ref, destFile.ref, {
               destinationBucket: destFile.bucket,
            })
      } catch (err) {
         console.error(err)
      }
   }

   async move(file: FileType, destFile: FileType) {
      Storage.info(
         `Moving file ${file.ref} to ${destFile.ref} in same bucket ${file.bucket}`
      )
      const { error } = await this._client
         .from(file.bucket)
         .move(file.ref, destFile.ref)

      if (error !== null) {
         Storage.error(
            `Unable to move ${file.ref} to ${destFile.ref}: ${error.message}`
         )
         throw new Error(`Unable to move ${file.ref} to ${destFile.ref}`)
      }

      return destFile
   }

   async getUrl(file: FileType, expiresIn = 3600) {
      Storage.debug(
         `Getting signed url for file ${file.ref} in bucket ${file.bucket}`
      )
      const { data, error } = await this._client
         .from(file.bucket)
         .createSignedUrl(file.ref, expiresIn, { download: true })

      if (error !== null) {
         throw new Error(`Unable to get signed url: ${error}`)
      }

      return { url: data?.signedUrl, expiresIn }
   }

   async delete(file: FileType) {
      Storage.info(`Deleting file ${file.ref} in bucket ${file.bucket}`)
      const { error } = await this._client.from(file.bucket).remove([file.ref])

      if (error !== null) {
         throw new Error(`Unable to delete ${file.ref}`)
      }

      Storage.info(`Object ${file.ref} successfully deleted`)

      return true
   }

   async getReadable(file: FileType): Promise<Readable> {
      Storage.debug(`GET Readable : ${file.ref}`)

      const path = join(tmpdir(), String(Date.now()))
      const item = await this.download(file, { path, onlyContent: true })
      const buffer = Buffer.from(item.toString(), 'base64')
      const readable = new Readable()
      readable.push(buffer)
      readable.push(null)

      return readable
   }

   async stream(file: FileType, res: any) {
      Storage.debug(`GET Stream : ${file.ref}`)

      const path = join(tmpdir(), String(Date.now()))
      const item = await this.download(file, { path, onlyContent: true })
      const buffer = Buffer.from(item.toString(), 'base64')
      const readable = new Readable()
      readable.push(buffer)
      readable.push(null)

      return readable.pipe(res)
   }

   async download(
      file: FileType,
      meta: DownloadFileMetaType
   ): Promise<string | Blob> {
      const { data, error } = await this._client
         .from(file.bucket)
         .download(file.ref)

      if (error !== null) {
         console.log(error)
         throw new Error(`Unable to download ${file.ref}`)
      }

      if (meta.onlyContent) {
         return data
      }

      // Write the downloaded data to the specified path
      const buffer = await data.arrayBuffer()
      fs.writeFileSync(meta.path, Buffer.from(buffer))

      return meta.path
   }

   /**
    * Get signed upload url for file
    * Careful, on docker the time to live for JWT signature is defaulted to 60 sec
    * Add SIGNED_UPLOAD_URL_EXPIRATION_TIME env variable to fix TTL
    * @param file FileType
    * @param _expiresIn actually ignored
    * @returns
    */
   async getUploadUrl(
      file: FileType,
      _expiresIn = 7200
   ): Promise<FileResponseLinkType> {
      const { data, error } = await this._client
         .from(file.bucket)
         .createSignedUploadUrl(file.ref, { upsert: true })

      if (error !== null) {
         throw new Error(`Unable to get signed upload url: ${error}`)
      }

      Storage.info(
         `Upload URL for ${file.ref} in bucket ${file.bucket} is ${data?.signedUrl}`
      )

      return {
         url: data?.signedUrl,
         method: 'PUT',
         accept: file.contentType || 'application/octet-stream',
         expiresIn: 7200, // fixed value in Supabase
      }
   }
}
