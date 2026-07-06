import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import {
   Storage,
   StorageParameters,
   AbstractStorageAdapter,
   DownloadFileMetaType,
   FileType,
   FileResponseUrlType,
   FileResponseLinkType,
} from '@quatrain/storage'
import { Readable } from 'node:stream'

/**
 * Storage adapter implementing Google Firebase Storage integration.
 * Uses `firebase-admin` to manage files, metadata, and signed URLs seamlessly
 * across Firebase buckets.
 */
export class FirebaseStorageAdapter extends AbstractStorageAdapter {
   constructor(params: StorageParameters = {}) {
      super(params)
      if (getApps().length === 0) {
         let credential = undefined
         if (this._params.config && this._params.config.credential) {
            const key = require(this._params.config.credential)
            credential = cert(key)
         }
         Storage.log(`[FBSA] Firebase Storage Adapter initialized`)
         initializeApp({ credential })
      }
   }

   /**
    * Provides access to the initialized Firebase `getStorage()` driver.
    * 
    * @returns The Firebase Storage instance.
    */
   getDriver() {
      return getStorage()
   }

   /**
    * Fetches explicit file metadata from Firebase, appending it to the footprint.
    * 
    * @param file - Target file footprint.
    * @returns A promise resolving to the file augmented with Firebase metadata.
    */
   getMetaData(file: FileType): Promise<FileType> {
      return getStorage()
         .bucket(file.bucket)
         .file(file.ref)
         .getMetadata()
         .then((data) => {
            const [metadata] = data
            return {
               ...file,
               metadata,
            }
         })
   }

   /**
    * Downloads a file from Firebase storage locally.
    * 
    * @param file - File footprint.
    * @param meta - Options containing the local path or instructing a content buffer return.
    * @returns A promise resolving to the local file path or raw buffer data.
    */
   async download(file: FileType, meta: DownloadFileMetaType) {
      const bucket = getStorage().bucket(file.bucket)
      if (meta.onlyContent) {
         return (await bucket.file(file.ref).download())[0]
      }
      await bucket.file(file.ref).download({ destination: meta.path })

      return meta.path
   }

   /**
    * Copies a file internally across or within Firebase buckets.
    * 
    * @param file - Original file.
    * @param destFile - Destination file footprint.
    */
   async copy(file: FileType, destFile: FileType) {
      getStorage()
         .bucket(file.bucket)
         .file(file.ref)
         .copy(getStorage().bucket(destFile.bucket).file(destFile.ref))
   }

   /**
    * Moves a file internally across or within Firebase buckets.
    * 
    * @param file - Source file.
    * @param destFile - Target destination.
    */
   async move(file: FileType, destFile: FileType) {
      getStorage()
         .bucket(file.bucket)
         .file(file.ref)
         .move(getStorage().bucket(destFile.bucket).file(destFile.ref))
   }

   /**
    * Uploads a local file stream to a designated Firebase Storage bucket.
    * 
    * @param File - Target file configuration.
    * @param stream - Readable stream containing file data.
    * @returns A promise resolving to the saved File footprint.
    */
   async create(File: FileType, stream: Readable): Promise<FileType> {
      const file = getStorage().bucket(File.bucket).file(File.ref)
      const writeStream = file.createWriteStream({})
      const pipelineFinished = await new Promise((resolve, reject) => {
         stream
            .pipe(writeStream)
            .on('error', (error: unknown) => {
               reject(error)
            })
            .on('finish', () => {
               resolve('Stream uploaded successfully!')
            })
      })
      await pipelineFinished

      return File
   }

   /**
    * Generates a signed access URL using `firebase-admin`.
    * 
    * @param fileData - The file to expose.
    * @param expiresIn - Expiration in seconds.
    * @param action - The requested action (e.g. 'read', 'write').
    * @param extra - Optional Firebase signed URL overrides.
    * @returns A promise resolving to the signed URL payload.
    */
   async getUrl(
      fileData: FileType,
      expiresIn: number = 7200,
      action?: string,
      extra?: any
   ): Promise<FileResponseUrlType> {
      const expires = new Date()
      expires.setSeconds(expires.getSeconds() + expiresIn)

      const [file] = await getStorage()
         .bucket(fileData.bucket)
         .file(fileData.ref)
         .getSignedUrl({
            action,
            expires,
            ...extra,
         })

      return {
         url: file,
         expiresIn: Number.parseInt((expires.valueOf() / 1000).toFixed(0)),
      }
   }

   /**
    * Deletes a file permanently from Firebase Storage.
    * 
    * @param file - Target file footprint.
    * @returns True if deleted successfully.
    */
   async delete(file: FileType) {
      const { bucket, ref } = file
      Storage.log(`${bucket} Removing linked file '${ref}' in `)

      try {
         await getStorage().bucket(bucket).file(ref).delete()
         return true
      } catch (err) {
         Storage.log(
            ` Error while removing linked file '${ref}': ${
               (err as Error).message
            }`
         )
      }
      return false
   }

   /**
    * Creates a readable stream and directly pipes it into an active response.
    * 
    * @param file - Target file.
    * @param res - Output writable stream.
    * @returns The piped stream instance.
    */
   async stream(file: FileType, res: any) {
      const bucket = getStorage().bucket()
      return bucket.file(file.ref).createReadStream().pipe(res)
   }

   /**
    * Generates a secure PUT/Write URL allowing direct Firebase uploads from the client.
    * 
    * @param file - Upload target.
    * @param duration - Token lifetime in seconds.
    * @returns A promise resolving to the upload instructions.
    */
   async getUploadUrl(
      file: FileType,
      duration: number = 3600
   ): Promise<FileResponseLinkType> {
      const { url, expiresIn } = await this.getUrl(file, duration, 'write', {
         version: 'v4',
         virtualHostedStyle: true,
      })

      return {
         url,
         method: 'PUT',
         accept: file.contentType || 'application/octet-stream',
         expiresIn,
      }
   }

   /**
    * Downloads the file content locally into memory and wraps it in a Readable stream.
    * Use carefully on large files to prevent buffer overflow.
    * 
    * @param file - Target file footprint.
    * @returns A promise resolving to a Readable buffer stream.
    * @throws {Error} If the file doesn't exist on the remote bucket.
    */
   async getReadable(file: FileType): Promise<Readable> {
      Storage.log('[GSA] Get readable of file', file.ref)
      const fileRef = getStorage().bucket(file.bucket).file(file.ref)
      const [exists] = await fileRef.exists()

      if (!exists) {
         throw new Error(`The file ${file.ref} does not exist!`)
      }
      const fileStream = fileRef.createReadStream()
      let fileContents = Buffer.from('')
      const pipelineFinished = await new Promise((resolve, reject) => {
         fileStream.on('data', (chunk: any) => {
            fileContents = Buffer.concat([fileContents, chunk])
            Storage.log(`Received chunk with ${chunk.length} bytes`)
         })
         fileStream.on('error', (error: any) => {
            Storage.log('Error reading file stream:', error)
         })
         fileStream.on('end', () => {
            Storage.log('File stream ended.')

            resolve('File stream ended.')
         })
      })
      await pipelineFinished

      console.log('Readable Length:', fileContents.length)
      const FileReadable = Readable.from(fileContents)
      console.log('FileReadable length :', FileReadable.readableLength)
      return FileReadable
   }
}
