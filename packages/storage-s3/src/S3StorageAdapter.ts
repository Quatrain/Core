import {
   AbstractStorageAdapter,
   Storage,
   FileType,
   FileResponseLinkType,
   StorageParameters,
   DownloadFileMetaType,
   BucketStatsType,
} from '@quatrain/storage'
import { Readable, Stream, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createWriteStream } from 'node:fs'
import {
   S3Client,
   PutObjectCommand,
   GetObjectCommand,
   GetObjectCommandInput,
   DeleteObjectCommand,
   CopyObjectCommand,
   HeadObjectCommand,
   ListBucketsCommand,
   ListObjectsV2Command,
   ListObjectsV2CommandInput,
   ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3'

export interface S3UrlExtraOptions {
   cacheControl?: string
}

export interface NonStreamResponseFallback {
   send?: (body: Buffer) => unknown
   write?: (chunk: Buffer) => unknown
   end?: () => unknown
}

type StreamTarget = Writable | NonStreamResponseFallback

/**
 * Storage adapter implementation for AWS S3 compatible services.
 * Implements direct stream uploads, true streaming downloads, presigned URLs, and bucket analytics.
 */
export class S3StorageAdapter extends AbstractStorageAdapter {
   protected _client: S3Client

   constructor(params: StorageParameters) {
      super(params)

      const config = {
         forcePathStyle: true,
         region: this._params.config.region,
         endpoint: this._params.config.endpoint,
         credentials: {
            accessKeyId: this._params.config.accesskey,
            secretAccessKey: this._params.config.secret,
         },
      }

      this._client = new S3Client(config)

      Storage.info(
         `AWS Storage Adapter initialized in ${
            this._params.config.endpoint || this._params.config.region
         }`
      )
   }

   /**
    * Validates the connection to the configured S3 endpoint by attempting to list buckets.
    *
    * @returns True if the connection succeeds and buckets are accessible.
    */
   async test(): Promise<boolean> {
      try {
         const command = new ListBucketsCommand({})
         await this._client.send(command)
         return true
      } catch (err) {
         Storage.error(`Failed to connect to S3: ${(err as Error).message}`)
         return false
      }
   }

   /**
    * Exposes the underlying AWS S3 Client instance.
    *
    * @returns The `S3Client` instance.
    */
   getDriver(): S3Client {
      return this._client
   }

   /**
    * Helper utility converting a Node.js Stream into a raw Buffer.
    * Required for S3 PUT payloads when streaming content lengths are indeterminate.
    *
    * @param stream - The input stream.
    * @returns A promise resolving to the concatenated Buffer.
    */
   async streamToBuffer(stream: Stream): Promise<Buffer> {
      return new Promise<Buffer>((resolve, reject) => {
         const chunks: Buffer[] = []

         stream.on('data', (chunk: Buffer | Uint8Array | string) => {
            if (typeof chunk === 'string') {
               chunks.push(Buffer.from(chunk, 'utf-8'))
            } else {
               chunks.push(Buffer.from(chunk))
            }
         })
         stream.on('end', () => resolve(Buffer.concat(chunks)))
         stream.on('error', (err) => reject(err))
      })
   }

   /**
    * Uploads a file stream directly into an S3 Bucket.
    *
    * @param file - Target file metadata.
    * @param stream - The content readable stream.
    * @returns A promise resolving to the uploaded FileType metadata.
    * @throws {Error} If the upload fails.
    */
   async create(file: FileType, stream: Readable): Promise<FileType> {
      try {
         const input = {
            Bucket: file.bucket || this._params.config.bucket,
            Key: file.ref,
            Body: await this.streamToBuffer(stream),
            ContentType: file.contentType,
         }
         Storage.debug(`Uploading ${file.ref} to ${file.bucket}`)

         const command = new PutObjectCommand(input)
         await this._client.send(command)

         return file
      } catch (err) {
         Storage.error(
            `Failed to upload file ${file.ref} to ${file.bucket}: ${
               (err as Error).message
            }`
         )
         throw new Error(
            `Failed to upload file ${file.ref} to ${file.bucket}: ${
               (err as Error).message
            }`
         )
      }
   }

   /**
    * Copies an existing object within S3 to a new destination key or bucket.
    *
    * @param file - Source file.
    * @param destFile - Destination file.
    */
   async copy(file: FileType, destFile: FileType): Promise<void> {
      Storage.debug(
         `Copying file ${file.bucket}/${file.ref} to ${file.bucket}/${destFile.ref}`
      )
      const command = new CopyObjectCommand({
         CopySource: encodeURI(`${file.bucket}/${file.ref}`),
         Bucket: file.bucket,
         Key: encodeURI(destFile.ref),
      })

      try {
         await this._client.send(command)
      } catch (err) {
         Storage.error(
            `Failed to copy file ${file.ref} to ${destFile.ref}: ${
               (err as Error).message
            }`
         )
      }
   }

   /**
    * Moves a file to a given destination within S3 by copying then deleting the source object.
    *
    * @param file - Source file metadata.
    * @param destFile - Destination file metadata.
    * @returns A promise resolving to the destination file metadata.
    */
   async move(file: FileType, destFile: FileType): Promise<FileType> {
      try {
         Storage.debug(
            `Moving file ${file.bucket}/${file.ref} to ${file.bucket}/${destFile.ref}`
         )
         await this.copy(file, destFile)
         await this.delete(file)
      } catch (err) {
         Storage.error(
            `Failed to move file from ${file.ref} to ${destFile.ref}: ${
               (err as Error).message
            }`
         )
      }

      return destFile
   }

   /**
    * Generates a temporary, presigned GET URL for public or secure access.
    *
    * @param file - Target file.
    * @param expiresIn - URL expiration time in seconds.
    * @param _action - The requested action ('read', etc.).
    * @param extra - Extra parameters such as 'cacheControl'.
    * @returns A promise resolving to the generated URL and expiration payload.
    */
   async getUrl(
      file: FileType,
      expiresIn = 3600,
      _action = 'read',
      extra?: S3UrlExtraOptions
   ): Promise<{ url: string; expiresIn: number }> {
      const commandArgs: GetObjectCommandInput = {
         Bucket: file.bucket || this._params.config.bucket,
         Key: encodeURI(file.ref),
      }

      const cacheControl =
         extra?.cacheControl ||
         (this._params.config.publicCacheDuration
            ? `max-age=${this._params.config.publicCacheDuration}`
            : undefined)

      if (cacheControl) {
         commandArgs.ResponseCacheControl = cacheControl
      }

      const command = new GetObjectCommand(commandArgs)
      Storage.debug(`Creating public url for ${commandArgs.Bucket}/${file.ref}`)
      const url = await getSignedUrl(this._client, command, { expiresIn })
      return { url, expiresIn }
   }

   /**
    * Deletes an object from the S3 Bucket.
    *
    * @param file - The file to remove.
    * @returns A promise resolving to true on success.
    */
   async delete(file: FileType): Promise<boolean> {
      Storage.debug(`Deleting file ${file.bucket}/${file.ref}`)
      const command = new DeleteObjectCommand({
         Bucket: file.bucket || this._params.config.bucket,
         Key: file.ref,
      })

      await this._client.send(command)
      Storage.info(`Object ${file.ref} successfully deleted`)

      return true
   }

   /**
    * Opens an S3 object and returns its body directly as a Node.js Readable stream
    * without buffering the entire payload in memory.
    *
    * @param file - The target file.
    * @returns A promise resolving to the Readable stream.
    */
   async getReadable(file: FileType): Promise<Readable> {
      Storage.debug(`GET Readable for ${file.ref}`)
      const command = new GetObjectCommand({
         Bucket: file.bucket || this._params.config.bucket,
         Key: file.ref,
      })
      const item = await this._client.send(command)
      const body = item.Body

      if (!body) {
         throw new Error(`Empty response body when reading S3 object: ${file.ref}`)
      }

      if (body instanceof Readable) {
         return body
      }

      const byteArray = await body.transformToByteArray()
      return Readable.from([Buffer.from(byteArray)])
   }

   /**
    * Issues a HEAD request to fetch S3 object metadata like size and content-type
    * without downloading the actual payload.
    *
    * @param file - The file footprint.
    * @returns A promise resolving to the augmented metadata.
    */
   async getMetaData(file: FileType): Promise<FileType> {
      const command = new HeadObjectCommand({
         Bucket: file.bucket || this._params.config.bucket,
         Key: file.ref,
      })
      const item = await this._client.send(command)
      return {
         ...file,
         contentType: item.ContentType,
         size: item.ContentLength,
         lastModified: item.LastModified,
      }
   }

   /**
    * Type guard verifying whether a target object behaves as a Node.js Writable stream.
    *
    * @param target - Candidate response or stream object.
    * @returns True if `target` exposes stream `.on` and `.write` methods.
    */
   private isWritableStream(target: unknown): target is Writable {
      if (typeof target !== 'object' || target === null) {
         return false
      }
      return (
         'on' in target &&
         typeof target.on === 'function' &&
         'write' in target &&
         typeof target.write === 'function'
      )
   }

   /**
    * Fetches and streams an S3 object into an external HTTP response or writable stream.
    * Piped directly without memory buffering if `res` is a Writable stream, or dispatches via
    * `.send()` / `.write()` as a defensive fallback for non-stream response wrappers.
    *
    * @param file - Target file footprint.
    * @param res - The response or writable stream (supports .pipe(), .send(), or .write()/.end()).
    * @returns The piped stream instance or response completion.
    */
   async stream(file: FileType, res: StreamTarget): Promise<unknown> {
      const readable = await this.getReadable(file)

      if (this.isWritableStream(res)) {
         return readable.pipe(res)
      }

      const buffer = await this.streamToBuffer(readable)
      if (typeof res?.send === 'function') {
         return res.send(buffer)
      }
      if (typeof res?.write === 'function' && typeof res?.end === 'function') {
         res.write(buffer)
         return res.end()
      }
      return undefined
   }

   /**
    * Streams an S3 object directly to the local filesystem using backpressure-safe pipeline.
    *
    * @param file - The remote file.
    * @param meta - Local download path instructions.
    * @returns A promise resolving to the local file path.
    */
   async download(file: FileType, meta: DownloadFileMetaType): Promise<string> {
      const stream = await this.getReadable(file)
      await pipeline(stream, createWriteStream(meta.path))

      return meta.path
   }

   /**
    * Generates a presigned PUT URL allowing clients to upload directly to S3, bypassing the backend.
    *
    * @param file - The requested upload file destination.
    * @param expiresIn - Token expiration in seconds.
    * @returns A promise resolving to the upload URL instructions.
    */
   async getUploadUrl(
      file: FileType,
      expiresIn = 3600
   ): Promise<FileResponseLinkType> {
      const command = new PutObjectCommand({
         Bucket: file.bucket || this._params.config.bucket,
         Key: file.ref,
         ContentType: file.contentType,
      })

      const url = await getSignedUrl(this._client, command, { expiresIn })

      return {
         url,
         method: 'PUT',
         accept: file.contentType || 'application/octet-stream',
         expiresIn,
      }
   }

   /**
    * Computes statistics for a given bucket in S3.
    * Iterates over all objects in the bucket to compute total count and size.
    *
    * @param bucket - Target bucket name.
    * @param prefix - Optional directory prefix.
    * @returns A promise resolving to bucket statistics.
    */
   async getBucketStats(
      bucket?: string,
      prefix?: string
   ): Promise<BucketStatsType> {
      const targetBucket = bucket || this._params.config.bucket
      let totalObjects = 0
      let totalSize = 0
      let isTruncated = true
      let continuationToken: string | undefined = undefined
      const folders: Record<
         string,
         {
            name: string
            path: string
            totalObjects: number
            totalSize: number
            lastModified?: Date
         }
      > = {}

      Storage.info(
         `Fetching bucket stats for ${targetBucket} (prefix: ${prefix || 'none'})`
      )

      const s3Prefix = prefix
         ? prefix.endsWith('/')
            ? prefix
            : `${prefix}/`
         : undefined

      while (isTruncated) {
         const input: ListObjectsV2CommandInput = {
            Bucket: targetBucket,
            ContinuationToken: continuationToken,
            Prefix: s3Prefix,
         }
         const command = new ListObjectsV2Command(input)
         const res: ListObjectsV2CommandOutput = await this._client.send(command)
         if (res.Contents) {
            for (const item of res.Contents) {
               const size = item.Size || 0
               totalObjects++
               totalSize += size

               if (item.Key) {
                  const parts = item.Key.split('/')
                  parts.pop()
                  const folderPath = parts.length > 0 ? parts.join('/') : '/'
                  const folderName =
                     parts.length > 0 ? parts[parts.length - 1] : '/'

                  if (!folders[folderPath]) {
                     folders[folderPath] = {
                        name: folderName,
                        path: folderPath,
                        totalObjects: 0,
                        totalSize: 0,
                        lastModified: item.LastModified,
                     }
                  } else if (item.LastModified) {
                     const currentLastMod = folders[folderPath].lastModified
                     if (!currentLastMod || item.LastModified > currentLastMod) {
                        folders[folderPath].lastModified = item.LastModified
                     }
                  }
                  folders[folderPath].totalObjects++
                  folders[folderPath].totalSize += size
               }
            }
         }
         isTruncated = res.IsTruncated ?? false
         continuationToken = res.NextContinuationToken
      }

      return {
         bucket: targetBucket,
         totalObjects,
         totalSize,
         folders,
      }
   }
}
