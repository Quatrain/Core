import {
   AbstractStorageAdapter,
   Storage,
   FileType,
   FileResponseLinkType,
   StorageParameters,
   DownloadFileMetaType,
} from '@quatrain/storage'
import { Readable, Stream } from 'stream'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createWriteStream } from 'fs'
import {
   S3Client,
   PutObjectCommand,
   GetObjectCommand,
   DeleteObjectCommand,
   CopyObjectCommand,
   HeadObjectCommand,
   ListBucketsCommand,
} from '@aws-sdk/client-s3'

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

   getDriver() {
      return this._client
   }

   async streamToBuffer(stream: Stream): Promise<Buffer> {
      return new Promise<Buffer>((resolve, reject) => {
         const _buf: any[] = []

         stream.on('data', (chunk) => _buf.push(chunk))
         stream.on('end', () => resolve(Buffer.concat(_buf)))
         stream.on('error', (err) => reject(err))
      })
   }

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

   async getReadable(file: FileType): Promise<Readable> {
      Storage.debug(`GET Readable for ${file.ref}`)
      const command = new GetObjectCommand({
         Bucket: file.bucket || this._params.config.bucket,
         Key: file.ref,
      })
      const item = await this._client?.send(command)
      const ByteArray: any = await item?.Body?.transformToByteArray()
      const buffer = Buffer.from(ByteArray, 'base64')
      const readable = new Readable()
      readable.push(buffer)
      readable.push(null)

      return readable
   }

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

   async stream(file: FileType, res: any) {
      const command = new GetObjectCommand({
         Bucket: file.bucket,
         Key: file.ref,
      })
      const item = await this._client.send(command)
      const ByteArray: any = await item.Body?.transformToByteArray()
      const buffer = Buffer.from(ByteArray, 'base64')
      const readable = new Readable()
      readable.push(buffer)
      readable.push(null)

      return readable.pipe(res)
   }

   async download(file: FileType, meta: DownloadFileMetaType) {
      const stream: Readable = await this.getReadable(file)
      await new Promise((res) =>
         stream.pipe(createWriteStream(meta.path)).on('close', () => res(true))
      )

      return meta.path
   }

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
}
