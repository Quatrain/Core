import { Readable } from 'stream'
import { FileType } from './types/FileType'
import { StorageAdapterInterface } from './StorageAdapterInterface'
import { DownloadFileMetaType } from './types/DownloadFileMetaType'
import { Storage, StorageParameters } from './Storage'

import { createReadStream } from 'fs'
import sharp from 'sharp'
import { join } from 'path'
import { tmpdir } from 'os'
import fs from 'fs-extra'
import hash from 'object-hash'
import { Core } from '@quatrain/core'

export abstract class AbstractStorageAdapter
   implements StorageAdapterInterface
{
   protected _client: any
   protected _alias: string = ''
   protected _params: StorageParameters = {}

   constructor(params: StorageParameters = {}) {
      this._alias = params.alias || ''
      this._params = params
   }

   abstract getDriver(): any

   abstract create(file: FileType, stream: Readable): Promise<FileType>

   abstract download(file: FileType, path: DownloadFileMetaType): Promise<any>

   abstract copy(file: FileType, destFile: FileType): Promise<any>

   abstract move(file: FileType, destFile: FileType): Promise<any>

   abstract getUrl(
      file: FileType,
      expiresIn?: number,
      action?: string,
      extra?: any
   ): Promise<any>

   abstract delete(file: FileType): Promise<boolean>

   abstract stream(file: FileType, res: any): Promise<any>

   abstract getUploadUrl(filePath: FileType, expiresIn?: number): Promise<any>

   abstract getReadable(file: FileType): Promise<Readable>

   abstract getMetaData(file: FileType): Promise<FileType>

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

   async generateImageThumbnail(file: FileType, sizes: number[]): Promise<any> {
      Storage.info(`Generating image thumbnail(s) for ${file.ref}`)
      const { name, bucketDir, extension } = this._getFileInfo(file)
      const thumbnailExtension = 'png'

      const workingDir = await this._setupThumbnailWorkspace(
         `thumbs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      )
      const path = join(workingDir, hash(name)) + `.${extension}`

      try {
         await this.download(file, { path })

         const uploadPromises = sizes.map(async (size) => {
            Storage.debug(`Generating ${size} thumbnail for ${name}`)
            return this._createAndUploadThumbnail(
               file,
               size,
               workingDir,
               bucketDir,
               thumbnailExtension,
               path
            )
         })

         const results = await Promise.all(uploadPromises)
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

   async generateVideoThumbnail(file: FileType, sizes: number[]): Promise<any> {
      Storage.info(`Generating video thumbnail(s) for ${file.ref}`)
      const { name, bucketDir, extension } = this._getFileInfo(file)
      const thumbnailExtension = 'png'

      const workingDir = await this._setupThumbnailWorkspace(
         `videothumbs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      )
      const tmpFilePath = join(workingDir, hash(name)) + `.${extension}`

      try {
         await this.download(file, { path: tmpFilePath })
         const ffmpeg = await Core.getSystemCommandPath('ffmpeg')

         const uploadPromises = sizes.map(async (size) => {
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

            return { [thumbName]: thumbnailRef }
         })

         const results = await Promise.all(uploadPromises)
         const thumbnails = Object.assign({}, ...results)

         await fs.remove(workingDir)
         return thumbnails
      } catch (e) {
         Storage.error(`Video thumbnail generation failed: ${e}`)
         return {}
      }
   }

   async generateDocumentThumbnail(
      file: FileType,
      sizes: number[]
   ): Promise<any> {
      Storage.info(`Generating document thumbnail(s) for ${file.ref}`)
      const { name, bucketDir, extension } = this._getFileInfo(file)
      const thumbnailExtension = 'png'

      const workingDir = await this._setupThumbnailWorkspace(
         `docthumbs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      )
      const tmpFilePath = join(workingDir, hash(name)) + `.${extension}`

      try {
         await this.download(file, { path: tmpFilePath })

         const magickCmd = await Core.getSystemCommandPath('magick')

         const uploadPromises = sizes.map(async (size) => {
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

            return this._createAndUploadThumbnail(
               file,
               size,
               workingDir,
               bucketDir,
               thumbnailExtension,
               tempThumbPath
            )
         })

         const results = await Promise.all(uploadPromises)
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
