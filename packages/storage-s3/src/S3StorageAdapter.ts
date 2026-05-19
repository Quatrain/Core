import {
   AbstractStorageAdapter,
   Storage,
   FileType,
   FileResponseLinkType,
   StorageParameters,
   DownloadFileMetaType,
   BucketStatsType,
} from '@quatrain/storage'
import { Readable, Stream } from 'node:stream'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createWriteStream } from 'node:fs'
import {
   S3Client,
   PutObjectCommand,
   GetObjectCommand,
   DeleteObjectCommand,
   CopyObjectCommand,
   HeadObjectCommand,
   ListBucketsCommand,
   ListObjectsV2Command,
   ListObjectsV2CommandInput,
   ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3'

/**
 * Storage adapter implementation for AWS S3 compatible services.
 * Implements direct stream uploads, presigned URLs, and multipart handling.
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
         const command = new ListBucketsCommand()
         const res = await this._client.send(command)
         //Storage.info(`S3 Buckets: ${JSON.stringify(res.Buckets)}`)
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
   getDriver() {
      return this._client
   }

   /**
    * Helper utility converting a Node.js Stream into a raw Buffer.
    * Required for S3 payloads when streaming sizes are indeterminate.
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
   async copy(file: FileType, destFile: FileType) {
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
         console.error(err)
      }
   }

   /**
    * Move file to given destination
    * There is no native command in AWS SDK for this, we need to copy then delete source media
    * @param file
    * @param destFile
    * @returns
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
         console.log(err)
      }

      return destFile
   }

   /**
    * Generates a temporary, presigned GET URL for public or secure access.
    * 
    * @param file - Target file.
    * @param expiresIn - URL expiration time in seconds.
    * @param action - The requested action ('read', etc.).
    * @param extra - Extra parameters such as 'cacheControl'.
    * @returns A promise resolving to the generated URL and expiration payload.
    */
   async getUrl(file: FileType, expiresIn = 3600, action: any = 'read', extra: any = {}) {
      const commandArgs: any = {
         Bucket: file.bucket,
         Key: encodeURI(file.ref),
      }

      const cacheControl = extra.cacheControl || (this._params.config.publicCacheDuration ? `max-age=${this._params.config.publicCacheDuration}` : undefined)

      if (cacheControl) {
         commandArgs.ResponseCacheControl = cacheControl
      }

      const command = new GetObjectCommand(commandArgs)
      Storage.debug(`Creating public url for ${file.bucket}/${file.ref}`)
      const url = await getSignedUrl(this._client, command, { expiresIn })
      return { url, expiresIn }
   }

   /**
    * Deletes an object from the S3 Bucket.
    * 
    * @param file - The file to remove.
    * @returns A promise resolving to true on success.
    */
   async delete(file: FileType) {
      Storage.debug(`Deleting file ${file.bucket}/${file.ref}`)
      const command = new DeleteObjectCommand({
         Bucket: file.bucket,
         Key: file.ref,
      })

      await this._client?.send(command)
      Storage.info(`Object ${file.ref} successfully deleted`)

      return true
   }

   /**
    * Downloads an S3 object and returns it as a Node.js Readable stream.
    * 
    * @param file - The target file.
    * @returns A promise resolving to the ReadStream.
    */
   async getReadable(file: FileType): Promise<Readable> {
      Storage.debug(`GET Readable for ${file.ref}`)
      const command = new GetObjectCommand({
         Bucket: file.bucket || this._params.config.bucket,
         Key: file.ref,
      })
      const item = await this._client?.send(command)
      const ByteArray: any = await item?.Body?.transformToByteArray()
      const buffer = Buffer.from(ByteArray)
      const readable = new Readable()
      readable.push(buffer)
      readable.push(null)

      return readable
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
         Bucket: file.bucket,
         Key: file.ref,
      })
      const item = await this._client.send(command)
      const meta = {
         ...file,
         contentType: item.ContentType,
         size: item.ContentLength,
         lastModified: item.LastModified,
      }

      return meta
   }

   /**
    * Directly pipes an S3 object to an external HTTP response or stream.
    * 
    * @param file - Target file.
    * @param res - The response or writable stream.
    * @returns The piped stream instance.
    */
   async stream(file: FileType, res: any) {
      const command = new GetObjectCommand({
         Bucket: file.bucket,
         Key: file.ref,
      })
      const item = await this._client.send(command)
      const ByteArray: any = await item.Body?.transformToByteArray()
      const buffer = Buffer.from(ByteArray)
      const readable = new Readable()
      readable.push(buffer)
      readable.push(null)

      return readable.pipe(res)
   }

   /**
    * Downloads an S3 object and writes it directly to the local filesystem.
    * 
    * @param file - The remote file.
    * @param meta - Local download path instructions.
    * @returns A promise resolving to the local file path.
    */
   async download(file: FileType, meta: DownloadFileMetaType) {
      const stream: Readable = await this.getReadable(file)
      await new Promise((res) =>
         stream.pipe(createWriteStream(meta.path)).on('close', () => res(true))
      )

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
    * @returns A promise resolving to bucket statistics.
    */
   async getBucketStats(bucket?: string): Promise<BucketStatsType> {
      const targetBucket = bucket || this._params.config.bucket
      let totalObjects = 0
      let totalSize = 0
      let isTruncated = true
      let continuationToken: string | undefined = undefined
      const folders: Record<string, any> = {}

      Storage.info(`Fetching bucket stats for ${targetBucket}`)

      while (isTruncated) {
         const input: ListObjectsV2CommandInput = {
            Bucket: targetBucket,
            ContinuationToken: continuationToken,
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
                  parts.pop() // remove file name to get exact folder
                  const folderPath = parts.length > 0 ? parts.join('/') : '/'
                  const folderName = parts.length > 0 ? parts[parts.length - 1] : '/'
                  
                  if (!folders[folderPath]) {
                     folders[folderPath] = { 
                        name: folderName,
                        path: folderPath,
                        totalObjects: 0, 
                        totalSize: 0,
                        lastModified: item.LastModified
                     }
                  } else if (item.LastModified) {
                     if (!folders[folderPath].lastModified || item.LastModified > folders[folderPath].lastModified) {
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
