import { Readable } from 'node:stream'
import { FileType } from './types/FileType'
import { StorageAdapterInterface } from './StorageAdapterInterface'
import { DownloadFileMetaType } from './types/DownloadFileMetaType'
import { BucketStatsType } from './types/BucketStatsType'
import { Storage, StorageParameters } from './Storage'

import { createReadStream } from 'node:fs'
import sharp from 'sharp'

// Optimize sharp for memory-constrained and Alpine Linux environments.
// Disabling the cache and setting concurrency to 1 dramatically reduces memory usage and prevents native OOM crashes on large files.
sharp.cache(false)
sharp.concurrency(1)

import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'fs-extra'
import hash from 'object-hash'
import { Core } from '@quatrain/core'
import { randomUUID } from 'node:crypto'

/**
 * Base abstract class defining the contract for all storage adapters.
 * Implements common logic for media thumbnailing and URL routing via gateways.
 */
export abstract class AbstractStorageAdapter
   implements StorageAdapterInterface
{
   protected _client: any
   protected _alias: string = ''
   protected _params: StorageParameters = {}

   constructor(params: StorageParameters = {}) {
      if (params.config && !params.config.bucket) {
         Storage.error(
            `${this.constructor.name} initialization failed: "bucket" is not defined in the configuration parameters.`
         )
         throw new Error(
            `${this.constructor.name} initialization failed: "bucket" is not defined in the configuration parameters.`
         )
      }
      this._alias = params.alias || ''
      this._params = params
   }

   /**
    * Returns the underlying SDK or driver instance.
    * 
    * @returns The raw storage client.
    */
   abstract getDriver(): any

   /**
    * Uploads a file stream to the storage backend.
    * 
    * @param file - Target file metadata.
    * @param stream - Readable data stream.
    * @returns A promise resolving to the uploaded File footprint.
    */
   abstract create(file: FileType, stream: Readable): Promise<FileType>

   /**
    * Downloads a remote file to a local destination.
    * 
    * @param file - File footprint to download.
    * @param path - Download configuration and destination path.
    * @returns A promise resolving to the local file path or raw data.
    */
   abstract download(file: FileType, path: DownloadFileMetaType): Promise<any>

   /**
    * Copies an existing file natively within the backend.
    * 
    * @param file - Source footprint.
    * @param destFile - Destination footprint.
    */
   abstract copy(file: FileType, destFile: FileType): Promise<any>

   /**
    * Moves/renames a file natively within the backend.
    * 
    * @param file - Source footprint.
    * @param destFile - Destination footprint.
    */
   abstract move(file: FileType, destFile: FileType): Promise<any>

   /**
    * Generates a raw, natively routable provider URL (e.g., S3 presigned URL).
    * 
    * @param file - The target file footprint.
    * @param expiresIn - Signature expiration in seconds.
    * @param action - Intended action ('read', 'write').
    * @param extra - Provider-specific overrides (e.g. { native: true }).
    * @returns A promise resolving to the final native URL payload.
    */
   abstract getUrl(
      file: FileType,
      expiresIn?: number,
      action?: string,
      extra?: any
   ): Promise<any>



   /**
    * Deletes a file from the backend storage.
    * 
    * @param file - The target file.
    * @returns True if successful.
    */
   abstract delete(file: FileType): Promise<boolean>

   /**
    * Directly pipes the remote file to a given local stream or HTTP response.
    * 
    * @param file - File footprint.
    * @param res - Output writable stream.
    */
   abstract stream(file: FileType, res: any): Promise<any>

   /**
    * Generates a direct-to-provider upload URL, bypassing the application server.
    * 
    * @param filePath - The intended file footprint.
    * @param expiresIn - Expiration of the upload link.
    */
   abstract getUploadUrl(filePath: FileType, expiresIn?: number): Promise<any>

   /**
    * Connects to the backend and returns a Node Readable stream of the file content.
    * 
    * @param file - Target file.
    * @returns A promise resolving to the ReadStream.
    */
   abstract getReadable(file: FileType): Promise<Readable>

   /**
    * Retrieves extended object metadata (like byte size and content-type) from the backend.
    * 
    * @param file - Target footprint.
    * @returns The augmented metadata block.
    */
   abstract getMetaData(file: FileType): Promise<FileType>

    /**
     * Computes statistics for a given bucket.
     * 
     * @param bucket - Target bucket name.
     * @param prefix - Optional directory prefix.
     * @returns A promise resolving to bucket statistics.
     */
    async getBucketStats(bucket?: string, prefix?: string): Promise<BucketStatsType> {
       throw new Error(`getBucketStats is not implemented in ${this.constructor.name}`)
    }

   protected async _setupThumbnailWorkspace(
      workingDirName: string
   ): Promise<string> {
      const workingDir = join(tmpdir(), workingDirName)
      await fs.ensureDir(workingDir)
      return workingDir
   }

   protected async _createAndUploadThumbnail(
      file: FileType,
      size: number,
      workingDir: string,
      bucketDir: string,
      thumbnailExtension: string,
      imagePath: string
   ): Promise<{ [key: string]: string }> {
      const thumbName = `thumb${size}`
      const thumbPath = join(workingDir, thumbName) + `.${thumbnailExtension}`

      await sharp(imagePath)
         .resize(size, size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 },
         })
         .png()
         .toFile(thumbPath)

      const thumbnailRef = join(bucketDir, thumbName) + `.${thumbnailExtension}`

      await this.create(
         {
            ...file,
            ref: thumbnailRef,
         },
         createReadStream(thumbPath)
      )

      return { [thumbName]: thumbnailRef }
   }

   protected _getFileInfo(file: FileType) {
      const name = file.name || file.ref
      const bucketDir = name.substring(0, name.lastIndexOf('/'))
      const extension = name.split('.').pop()?.toLowerCase() || ''
      return { name, bucketDir, extension }
   }

   protected _isDocumentType(file: FileType, extension: string): boolean {
      const documentExtensions = [
         'pdf',
         'doc',
         'docx',
         'ppt',
         'pptx',
         'xls',
         'xlsx',
         'odt',
         'odp',
         'ods',
         'rtf',
      ]
      return (
         documentExtensions.includes(extension) ||
         Boolean(file.contentType?.includes('pdf')) ||
         Boolean(file.contentType?.includes('msword')) ||
         Boolean(file.contentType?.includes('wordprocessingml')) ||
         Boolean(file.contentType?.includes('powerpoint')) ||
         Boolean(file.contentType?.includes('presentationml')) ||
         Boolean(file.contentType?.includes('excel')) ||
         Boolean(file.contentType?.includes('spreadsheetml'))
      )
   }

   /**
    * Downloads an image, generates resized thumbnails via `sharp`, and uploads them back.
    * 
    * @param file - Original image footprint.
    * @param sizes - Array of desired thumbnail dimensions (px).
    * @returns A mapping of generated thumbnail identifiers to their respective storage refs.
    */
   async generateImageThumbnail(file: FileType, sizes: number[]): Promise<any> {
      Storage.info(
         `Generating image thumbnail(s) for ${file.ref} (sizes: [${sizes.join(', ')}])`
      )
      const { name, bucketDir, extension } = this._getFileInfo(file)
      const thumbnailExtension = 'png'

      const workingDir = await this._setupThumbnailWorkspace(
         `thumbs-${Date.now()}-${randomUUID()}`
      )
      const path = join(workingDir, hash(name)) + `.${extension}`

      try {
         await this.download(file, { path })

         const results: Array<{ [key: string]: string }> = []
         for (const size of sizes) {
            Storage.debug(`Generating ${size} thumbnail for ${name}`)
            const result = await this._createAndUploadThumbnail(
               file,
               size,
               workingDir,
               bucketDir,
               thumbnailExtension,
               path
            )
            results.push(result)
         }

         const thumbnails = Object.assign({}, ...results)

         await fs.remove(workingDir)
         return thumbnails
      } catch (err) {
         Storage.error(
            `Thumbnail generation for ${file.name} failed with error: ${err}`
         )
         return {}
      }
   }

   /**
    * Extracts a single frame from a remote video via `ffmpeg`, resizes it, and uploads the frame as an image thumbnail.
    * 
    * @param file - Original video footprint.
    * @param sizes - Array of desired thumbnail dimensions (px).
    * @returns A mapping of generated thumbnail identifiers to their respective storage refs.
    */
   async generateVideoThumbnail(file: FileType, sizes: number[]): Promise<any> {
      Storage.info(
         `Generating video thumbnail(s) for ${file.ref} (sizes: [${sizes.join(', ')}])`
      )
      const { name, bucketDir, extension } = this._getFileInfo(file)
      const thumbnailExtension = 'png'

      const workingDir = await this._setupThumbnailWorkspace(
         `videothumbs-${Date.now()}-${randomUUID()}`
      )
      const tmpFilePath = join(workingDir, hash(name)) + `.${extension}`

      try {
         await this.download(file, { path: tmpFilePath })
         const ffmpeg = await Core.getSystemCommandPath('ffmpeg')

         const results: Array<{ [key: string]: string }> = []
         for (const size of sizes) {
            const localThmbFilePath = `${tmpFilePath}.thumb${size}.${thumbnailExtension}`

            const ffmpegParams = [
               '-i',
               tmpFilePath,
               '-vframes',
               '1',
               '-vf',
               String.raw`select=gte(n\,0)`,
               '-s',
               `${size}x${Math.ceil(size * 0.7)}`,
               '-ss',
               '1',
               localThmbFilePath,
               '-y',
            ]

            await Core.execPromise(ffmpeg, ffmpegParams)

            const thumbName = `thumb${size}`
            const thumbnailRef =
               join(bucketDir, thumbName) + `.${thumbnailExtension}`

            await this.create(
               {
                  ...file,
                  ref: thumbnailRef,
                  contentType: 'image/png',
               },
               createReadStream(localThmbFilePath)
            )

            results.push({ [thumbName]: thumbnailRef })
         }

         const thumbnails = Object.assign({}, ...results)

         await fs.remove(workingDir)
         return thumbnails
      } catch (e) {
         Storage.error(`Video thumbnail generation failed: ${e}`)
         return {}
      }
   }

   /**
    * Extracts the first page of a document (e.g. PDF) via `ImageMagick`, resizes it, and uploads it as a thumbnail.
    * 
    * @param file - Original document footprint.
    * @param sizes - Array of desired thumbnail dimensions (px).
    * @returns A mapping of generated thumbnail identifiers to their respective storage refs.
    */
   async generateDocumentThumbnail(
      file: FileType,
      sizes: number[]
   ): Promise<any> {
      Storage.info(
         `Generating document thumbnail(s) for ${file.ref} (sizes: [${sizes.join(', ')}])`
      )
      const { name, bucketDir, extension } = this._getFileInfo(file)
      const thumbnailExtension = 'png'

      const workingDir = await this._setupThumbnailWorkspace(
         `docthumbs-${Date.now()}-${randomUUID()}`
      )
      const tmpFilePath = join(workingDir, hash(name)) + `.${extension}`

      try {
         await this.download(file, { path: tmpFilePath })

         const magickCmd = await Core.getSystemCommandPath('magick')

         const results: Array<{ [key: string]: string }> = []
         for (const size of sizes) {
            const tempThumbPath = join(
               workingDir,
               `temp_thumb${size}.${thumbnailExtension}`
            )

            const convertParams = [
               `${tmpFilePath}[0]`,
               '-thumbnail',
               `${size}x${size}`,
               '-background',
               'white',
               '-alpha',
               'remove',
               '-density',
               '150',
               tempThumbPath,
            ]

            await Core.execPromise(magickCmd, convertParams)
            Storage.debug(`Generated ${size} document thumbnail for ${name}`)

            const result = await this._createAndUploadThumbnail(
               file,
               size,
               workingDir,
               bucketDir,
               thumbnailExtension,
               tempThumbPath
            )
            results.push(result)
         }

         const thumbnails = Object.assign({}, ...results)

         await fs.remove(workingDir)
         return thumbnails
      } catch (err) {
         Storage.error(
            `Document thumbnail generation for ${file.name} failed with error: ${err}`
         )
         await fs.remove(workingDir)
         return {}
      }
   }

   /**
    * Entry point for thumbnail generation. Analyzes the content type and automatically
    * delegates to the appropriate generation strategy (Image, Video, or Document).
    * 
    * @param file - Target file footprint.
    * @param sizes - Desired dimensions.
    * @returns The generated thumbnail map, or an empty object if unsupported/failed.
    */
   async generateThumbnail(file: FileType, sizes: number[]): Promise<any> {
      const [type] = file.contentType
         ? file.contentType.split('/')
         : 'application/octet-stream'
      const { extension } = this._getFileInfo(file)

      try {
         switch (type) {
            case 'image':
               return await this.generateImageThumbnail(file, sizes)

            case 'video':
               return await this.generateVideoThumbnail(file, sizes)

            case 'application':
               if (this._isDocumentType(file, extension)) {
                  return await this.generateDocumentThumbnail(file, sizes)
               } else if (extension === 'jpg') {
                  console.log(`Processing possible missed image: ${file.ref}`)
                  return await this.generateImageThumbnail(file, sizes)
               } else {
                  console.log(
                     `Application type ${file.contentType} with extension ${extension} is not supported for thumbnailing`
                  )
               }
               break

            default:
               if (this._isDocumentType(file, extension)) {
                  console.log(
                     `Attempting document thumbnail for ${file.ref} based on extension`
                  )
                  return await this.generateDocumentThumbnail(file, sizes)
               } else {
                  console.log(
                     `${file.name} type (${file.contentType}) with extension (${extension}) can't be thumbnailed!`
                  )
               }
               break
         }
      } catch (err) {
         Storage.log(
            `Thumbnail generation for ${file.ref} failed with error: ${err}`
         )
      }

      return {}
   }
}
