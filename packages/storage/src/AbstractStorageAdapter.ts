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

import { join, posix } from 'node:path'
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
   protected _client: unknown
   protected _alias: string = ''
   protected _params: StorageParameters = {}

   constructor(params?: StorageParameters) {
      const resolvedParams: StorageParameters = params || {}
      if (resolvedParams.config && !resolvedParams.config.bucket) {
         Storage.error(
            `${this.constructor.name} initialization failed: "bucket" is not defined in the configuration parameters.`
         )
         throw new Error(
            `${this.constructor.name} initialization failed: "bucket" is not defined in the configuration parameters.`
         )
      }
      this._alias = resolvedParams.alias || ''
      this._params = resolvedParams
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
   async getBucketStats(
      bucket?: string,
      prefix?: string
   ): Promise<BucketStatsType> {
      void bucket
      void prefix
      throw new Error(
         `getBucketStats is not implemented in ${this.constructor.name}`
      )
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

      const thumbnailRef =
         posix.join(bucketDir, thumbName) + `.${thumbnailExtension}`

      await this.create(
         {
            ...file,
            ref: thumbnailRef,
            contentType:
               thumbnailExtension === 'png' ? 'image/png' : file.contentType,
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
    * Attempts to resolve a signed HTTP(S) URL suitable for direct FFmpeg HTTP Range seeking.
    * Only accepts structured `{ url: string }` payloads returned by remote cloud adapters
    * (e.g. S3StorageAdapter, SupabaseStorageAdapter) so local/mock adapters use local files.
    *
    * @param file - Source video file footprint.
    * @returns The signed HTTP(S) URL if available, otherwise undefined.
    */
   protected async _resolveRemoteVideoUrl(
      file: FileType
   ): Promise<string | undefined> {
      try {
         const urlPayload: unknown = await this.getUrl(file, 300, 'read')
         if (
            typeof urlPayload === 'object' &&
            urlPayload !== null &&
            'url' in urlPayload &&
            typeof urlPayload.url === 'string' &&
            (urlPayload.url.startsWith('http://') ||
               urlPayload.url.startsWith('https://'))
         ) {
            return urlPayload.url
         }
      } catch (err) {
         Storage.debug(
            `Unable to resolve remote video URL for ${file.ref}, falling back to download: ${err}`
         )
      }
      return undefined
   }

   /**
    * Extracts a single video frame into a PNG image using FFmpeg fast input seeking (`-ss` before `-i`).
    * Tries `1s` first and falls back to `0s` for sub-second video clips.
    *
    * @param ffmpeg - Resolved path to the FFmpeg binary.
    * @param inputSource - Local file path or signed HTTP(S) URL.
    * @param frameOutputPath - Destination path for the extracted PNG frame.
    * @returns True if a non-empty frame file was extracted.
    */
   protected async _extractVideoFrame(
      ffmpeg: string,
      inputSource: string,
      frameOutputPath: string
   ): Promise<boolean> {
      for (const seekSeconds of ['1', '0']) {
         try {
            await Core.execPromise(ffmpeg, [
               '-ss',
               seekSeconds,
               '-i',
               inputSource,
               '-vframes',
               '1',
               frameOutputPath,
               '-y',
            ])
            if (await fs.pathExists(frameOutputPath)) {
               const stat = await fs.stat(frameOutputPath)
               if (stat.size > 0) {
                  return true
               }
            }
         } catch (err) {
            Storage.debug(
               `FFmpeg frame extraction at ${seekSeconds}s failed for ${fileShortLabel(inputSource)}: ${err}`
            )
         }
      }
      return false
   }

   /**
    * Downloads an image, generates resized thumbnails via `sharp`, and uploads them back.
    *
    * @param file - Original image footprint.
    * @param sizes - Array of desired thumbnail dimensions (px).
    * @returns A mapping of generated thumbnail identifiers to their respective storage refs.
    */
   async generateImageThumbnail(
      file: FileType,
      sizes: number[]
   ): Promise<Record<string, string>> {
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

         return Object.assign({}, ...results)
      } catch (err) {
         Storage.error(
            `Thumbnail generation for ${file.name || file.ref} failed with error: ${err}`
         )
         return {}
      } finally {
         await fs.remove(workingDir).catch(() => undefined)
      }
   }

   /**
    * Extracts a single frame from a video via `ffmpeg` (preferring direct HTTP Range seeking
    * on presigned URLs before falling back to streaming download), then resizes that single frame
    * sequentially into all requested thumbnail dimensions via `sharp`.
    *
    * @param file - Original video footprint.
    * @param sizes - Array of desired thumbnail dimensions (px).
    * @returns A mapping of generated thumbnail identifiers to their respective storage refs.
    */
   async generateVideoThumbnail(
      file: FileType,
      sizes: number[]
   ): Promise<Record<string, string>> {
      Storage.info(
         `Generating video thumbnail(s) for ${file.ref} (sizes: [${sizes.join(', ')}])`
      )
      const { name, bucketDir, extension } = this._getFileInfo(file)
      const thumbnailExtension = 'png'

      const workingDir = await this._setupThumbnailWorkspace(
         `videothumbs-${Date.now()}-${randomUUID()}`
      )
      const tmpFilePath = join(workingDir, hash(name)) + `.${extension}`
      const rawFramePath = join(workingDir, `frame.${thumbnailExtension}`)

      try {
         const ffmpeg = await Core.getSystemCommandPath('ffmpeg')
         let extracted = false

         const remoteUrl = await this._resolveRemoteVideoUrl(file)
         if (remoteUrl) {
            extracted = await this._extractVideoFrame(
               ffmpeg,
               remoteUrl,
               rawFramePath
            )
         }

         if (!extracted) {
            await this.download(file, { path: tmpFilePath })
            extracted = await this._extractVideoFrame(
               ffmpeg,
               tmpFilePath,
               rawFramePath
            )
         }

         if (!extracted) {
            throw new Error(`Unable to extract video frame for ${file.ref}`)
         }

         const results: Array<{ [key: string]: string }> = []
         for (const size of sizes) {
            Storage.debug(`Generating ${size} video thumbnail for ${name}`)
            const result = await this._createAndUploadThumbnail(
               file,
               size,
               workingDir,
               bucketDir,
               thumbnailExtension,
               rawFramePath
            )
            results.push(result)
         }

         return Object.assign({}, ...results)
      } catch (e) {
         Storage.error(`Video thumbnail generation failed: ${e}`)
         return {}
      } finally {
         await fs.remove(workingDir).catch(() => undefined)
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
   ): Promise<Record<string, string>> {
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

         return Object.assign({}, ...results)
      } catch (err) {
         Storage.error(
            `Document thumbnail generation for ${file.name || file.ref} failed with error: ${err}`
         )
         return {}
      } finally {
         await fs.remove(workingDir).catch(() => undefined)
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
                  Storage.info(`Processing possible missed image: ${file.ref}`)
                  return await this.generateImageThumbnail(file, sizes)
               } else {
                  Storage.debug(
                     `Application type ${file.contentType} with extension ${extension} is not supported for thumbnailing`
                  )
               }
               break

            default:
               if (this._isDocumentType(file, extension)) {
                  Storage.info(
                     `Attempting document thumbnail for ${file.ref} based on extension`
                  )
                  return await this.generateDocumentThumbnail(file, sizes)
               } else {
                  Storage.debug(
                     `${file.name || file.ref} type (${file.contentType}) with extension (${extension}) can't be thumbnailed!`
                  )
               }
               break
         }
      } catch (err) {
         Storage.error(
            `Thumbnail generation for ${file.ref} failed with error: ${err}`
         )
      }

      return {}
   }

   /**
    * Checks if the file is a video or audio stream based on its MIME type or file extension.
    *
    * @param file - Target file.
    * @returns True if the file represents a video or audio asset.
    */
   protected isVideoOrAudio(file: FileType): boolean {
      const isMimeVideoOrAudio =
         file.contentType &&
         (file.contentType.startsWith('video/') ||
            file.contentType.startsWith('audio/'))
      if (isMimeVideoOrAudio) {
         return true
      }

      const filename = (file.ref || '').toLowerCase()
      const videoAudioExtensions = [
         '.mp4',
         '.webm',
         '.ogg',
         '.mov',
         '.m4v',
         '.avi',
         '.mkv',
         '.flv',
         '.3gp',
         '.wmv',
         '.mp3',
         '.wav',
         '.m4a',
         '.aac',
         '.flac',
         '.wma',
      ]
      return videoAudioExtensions.some((ext) => filename.endsWith(ext))
   }
}

/**
 * Redacts query parameters from signed URLs in diagnostic logs.
 *
 * @param inputSource - File path or signed URL.
 * @returns Sanitized path or URL origin + pathname.
 */
function fileShortLabel(inputSource: string): string {
   const queryIdx = inputSource.indexOf('?')
   return queryIdx === -1 ? inputSource : inputSource.slice(0, queryIdx)
}
