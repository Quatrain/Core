import {
   Storage,
   AbstractStorageAdapter,
   FileType,
   FileResponseLinkType,
   StorageParameters,
   DownloadFileMetaType,
} from '@quatrain/storage'
import { Readable, Stream } from 'node:stream'
import { StorageClient } from '@supabase/storage-js'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'node:fs'

/**
 * Storage adapter implementation targeting Supabase Storage.
 * Interfaces with the `@supabase/storage-js` client to manage buckets,
 * secure signed URLs, and file uploads.
 */
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

   /**
    * Exposes the underlying Supabase `StorageClient` instance.
    * 
    * @returns The storage client.
    */
   getDriver() {
      return this._client
   }

   /**
    * Retrieves file metadata. Currently acts as a passthrough for Supabase.
    * 
    * @param file - Target file footprint.
    * @returns The file metadata.
    */
   getMetaData(file: FileType): Promise<FileType> {
      return new Promise(() => file)
   }

   /**
    * Validates backend connectivity by listing available buckets in the Supabase project.
    * 
    * @returns True if connected.
    */
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

   /**
    * Helper converting a node stream to a Buffer, essential for Blob creation.
    * 
    * @param stream - The input stream.
    * @returns A promise resolving to the concatenated Buffer.
    */
   async streamToBuffer(stream: Stream): Promise<Buffer> {
      return new Promise<Buffer>((resolve, reject) => {
         const _buf: any[] = []

         stream.on('data', (chunk) => _buf.push(chunk))
         stream.on('end', () => resolve(Buffer.concat(_buf)))
         stream.on('error', (err) => reject(err))
      })
   }

   /**
    * Internal helper to convert a Buffer into a native ArrayBuffer.
    * 
    * @param buffer - The raw Buffer.
    * @returns The ArrayBuffer representation.
    */
   toArrayBuffer(buffer: Buffer): ArrayBuffer {
      const arrayBuffer = new ArrayBuffer(buffer.length)
      const view = new Uint8Array(arrayBuffer)
      for (let i = 0; i < buffer.length; ++i) {
         view[i] = buffer[i]
      }
      return arrayBuffer
   }

   /**
    * Uploads a local file path or stream to the Supabase storage bucket.
    * 
    * @param file - Target file schema.
    * @param stream - Readable stream or string path to the file.
    * @returns A promise resolving to the created file footprint.
    * @throws {Error} If upload is rejected.
    */
   async create(file: FileType, stream: Readable | string): Promise<FileType> {
      Storage.info(`[SSA] Uploading ${file.ref} to ${file.bucket}`)

      if (typeof stream === 'string') {
         const { error } = await this._client
            .from(file.bucket)
            .upload(file.ref, new Blob([fs.readFileSync(stream)]), {
               upsert: Storage.defaultUpsert,
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
               upsert: Storage.defaultUpsert,
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

   /**
    * Copies a file to a new destination key natively on the Supabase backend.
    * 
    * @param file - Original file.
    * @param destFile - Target destination.
    */
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

   /**
    * Moves/Renames an existing file natively within Supabase Storage.
    * 
    * @param file - The source file.
    * @param destFile - The target file.
    * @returns A promise resolving to the newly placed destination file.
    * @throws {Error} If the move operation fails.
    */
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

   /**
    * Generates a secure, temporary GET link to access the object remotely.
    * 
    * @param file - The file footprint.
    * @param expiresIn - URL expiration in seconds.
    * @param action - Intended action context.
    * @param extra - Optional parameters (e.g. cache configurations).
    * @returns A promise resolving to the signed URL payload.
    * @throws {Error} If signature creation fails.
    */
   async getUrl(file: FileType, expiresIn = 3600, action: any = 'read', extra: any = {}) {
      Storage.debug(
         `Getting signed url for file ${file.ref} in bucket ${file.bucket}`
      )

      const cacheControl = extra.cacheControl || (this._params.config.publicCacheDuration ? `${this._params.config.publicCacheDuration}` : undefined)

      // TODO: Le client Supabase JS ne supporte pas nativement l'override du ResponseCacheControl dans createSignedUrl.
      // La variable publicCacheDuration / cacheControl n'est donc pas gérée correctement ici pour le moment.
      // Voir si le SDK de Supabase permet de la supporter dans le futur.
      
      const { data, error } = await this._client
         .from(file.bucket)
         .createSignedUrl(file.ref, expiresIn, { download: true })

      if (error !== null) {
         throw new Error(`Unable to get signed url: ${error}`)
      }

      return { url: data?.signedUrl, expiresIn }
   }

   /**
    * Permanently removes the file from the Supabase bucket.
    * 
    * @param file - Target file.
    * @returns True upon success.
    */
   async delete(file: FileType) {
      Storage.info(`Deleting file ${file.ref} in bucket ${file.bucket}`)
      const { error } = await this._client.from(file.bucket).remove([file.ref])

      if (error !== null) {
         throw new Error(`Unable to delete ${file.ref}`)
      }

      Storage.info(`Object ${file.ref} successfully deleted`)

      return true
   }

   /**
    * Downloads the file content to a temporary location and returns a Readable stream.
    * 
    * @param file - File to read.
    * @returns The content as a stream.
    */
   async getReadable(file: FileType): Promise<Readable> {
      Storage.debug(`GET Readable : ${file.ref}`)

      const path = join(tmpdir(), String(Date.now()))
      const item = await this.download(file, { path, onlyContent: true })
      const arrayBuffer = await (item as Blob).arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const readable = new Readable()
      readable.push(buffer)
      readable.push(null)

      return readable
   }

   /**
    * Fetches and pipes the file content into the given response stream.
    * 
    * @param file - File to stream.
    * @param res - Writable stream or HTTP response object.
    * @returns The piped stream instance.
    */
   async stream(file: FileType, res: any) {
      Storage.debug(`GET Stream : ${file.ref}`)

      const path = join(tmpdir(), String(Date.now()))
      const item = await this.download(file, { path, onlyContent: true })
      const arrayBuffer = await (item as Blob).arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const readable = new Readable()
      readable.push(buffer)
      readable.push(null)

      return readable.pipe(res)
   }

   /**
    * Downloads the file directly, either returning the blob content or saving it locally.
    * 
    * @param file - File footprint.
    * @param meta - Options dictating save path or return format.
    * @returns A promise resolving to the blob or local file path.
    */
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
         .createSignedUploadUrl(file.ref, { upsert: Storage.defaultUpsert })

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
