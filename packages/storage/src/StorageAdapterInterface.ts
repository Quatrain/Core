import { Readable } from 'node:stream'
import { FileType } from './types/FileType'
import { DownloadFileMetaType } from './types/DownloadFileMetaType'
import { BucketStatsType } from './types/BucketStatsType'

/**
 * These are the public functions that any storage adapter must expose
 */
export interface StorageAdapterInterface {
   getDriver(): any
   create(file: FileType, stream: Readable): Promise<FileType>
   copy(file: FileType, destFile: FileType): Promise<any>
   move(file: FileType, destFile: FileType): Promise<any>
   delete(file: FileType): Promise<Boolean>
   stream(file: FileType, res: any): Promise<any>
   download(file: FileType, path: DownloadFileMetaType): Promise<string>
   getUrl(
      file: FileType,
      expiresIn?: number,
      action?: string,
      extra?: any
   ): Promise<any>
   getUploadUrl(filePath: FileType, expiresIn?: number): Promise<any>
   getReadable(filePath: FileType): Promise<Readable>
   getMetaData(filePath: FileType): Promise<FileType>
   generateThumbnail(file: FileType, sizes: number[]): Promise<any>
   generateImageThumbnail(file: FileType, sizes: number[]): Promise<any>
   generateVideoThumbnail(file: FileType, sizes: number[]): Promise<any>
   getBucketStats(bucket?: string, prefix?: string): Promise<BucketStatsType>
}
