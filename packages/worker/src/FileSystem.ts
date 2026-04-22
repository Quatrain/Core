import fs, { readFileSync } from 'node:fs'
import path from 'node:path'
import axios from 'axios'
import { Worker } from './Worker'
import fetch from 'node-fetch-native'
import * as ffmpeg from 'fluent-ffmpeg'
import { FileType } from '@quatrain/storage'

export class FileSystem {
   static prepare(folder: string) {
      Worker.debug(`Setting up process folder ${folder}`)
      this.removeFolder(folder)

      fs.mkdirSync(folder)
      fs.mkdirSync(folder + path.sep + 'images')
      fs.mkdirSync(folder + path.sep + 'vecto')
   }

   static makeFolder(folder: string) {
      fs.mkdirSync(folder)
   }

   static removeFolder(folder: string, recursively = true) {
      if (fs.existsSync(folder)) {
         fs.readdirSync(folder).forEach((element) => {
            const item = path.join(folder, element)
            if (fs.lstatSync(item).isDirectory()) {
               if (recursively !== true) {
                  throw new Error(`Folder contains folder`)
               }
               this.removeFolder(item)
            } else {
               fs.unlinkSync(item)
            }
         })

         fs.rmdirSync(folder)
      }
   }

   static async downloadFile(url: string, filepath: string) {
      try {
         Worker.debug(`Downloading file at ${url} to ${filepath}`)
         const writer = fs.createWriteStream(filepath)
         const response = await axios.get(url, {
            responseType: 'stream',
         })

         response.data.pipe(writer)

         return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(true))
            writer.on('error', (err) => reject(err))
         })
      } catch (err) {
         Worker.error(`Download error: ${(err as Error).message}`)
         throw err
      }
   }

   static safeString(name: string) {
      return name.replace(/\s+/g, '_')
   }

   /**
    * Upload file to public URL and return meta data
    * @param filename string
    * @param meta
    * @param mime
    * @returns Promise
    */
   static uploadFile(
      filename: string,
      meta: FileType,
      mime = 'video/mp4'
   ): Promise<FileType> {
      // try to get more file metadata
      meta = { ...meta, ...FileSystem.getInfo(filename) }
      Worker.info(`Uploading file ${filename} to ${meta.uploadUrl}`)
      const { size } = fs.statSync(filename)

      if (size < 32 * 1024) {
         return new Promise((resolve, reject) => {
            fetch(meta.uploadUrl, {
               method: 'PUT',
               mode: 'cors',
               duplex: 'half',
               body: readFileSync(filename),
               headers: {
                  'Content-Type': meta.contentType || mime,
                  'Content-length': String(size),
               },
            })
               .then(() => resolve({ ...meta, size, uploadUrl: undefined }))
               .catch((err) => {
                  Worker.error(
                     `An error occured while uploading ${filename}: ${err.message}`
                  )
                  reject(err)
               })
         })
      }

      return new Promise((resolve, reject) => {
         try {
            let done = 0 // total bytes uploaded
            let prev = 0 // latest value of done stored when % done was displayed
            const { size } = fs.statSync(filename)
            const readStream = fs.createReadStream(filename)

            const sizeMB = (size / (1024 * 1024)).toFixed(2)

            readStream.on('data', (data) => {
               done += data.length
               if (done - prev >= size / 20) {
                  // only display message when 5% more has been uploaded
                  Worker.info(
                     `${((done / size) * 100).toFixed(2)}% - ${(
                        done /
                        (1024 * 1024)
                     ).toFixed(2)}MB / ${sizeMB}MB`
                  )
                  prev = done
               }
            })

            Worker.info(`Uploading file ${filename} with size ${size} bytes`)
            fetch(meta.uploadUrl, {
               method: 'PUT',
               mode: 'cors',
               duplex: 'half',
               body: readStream,
               headers: {
                  'Content-Type': meta.contentType || mime,
                  'Content-length': String(size),
               },
            })
               .then(() => resolve({ ...meta, size, uploadUrl: undefined }))
               .catch((err) => {
                  Worker.error(
                     `An error occured while uploading ${filename}: ${err.message}`
                  )
                  reject(err)
               })
         } catch (err) {
            Worker.error(err)
            reject(err)
         }
      })
   }

   /**
    * Return meta data on given file
    */
   static getInfo = (file: string): Promise<any> => {
      if (file.endsWith('.mp4') || file.endsWith('.insv')) {
         return new Promise((resolve, reject) =>
            ffmpeg.ffprobe(file, (err: any, metadata: any) => {
               if (err) {
                  Worker.error(err)
                  reject(err)
               }
               //   Worker.debug(`ffprobe getInfo: ${JSON.stringify(metadata)}`)
               const {
                  width,
                  height,
                  duration,
                  bit_rate: bitrate,
                  nb_frames: nbFramees,
               } = metadata.streams[0]
               const nb_frames: number = parseFloat(nbFramees as string)
               const framerate = nb_frames / parseFloat(duration as string)
               resolve({
                  width,
                  height,
                  framerate: parseInt(framerate.toFixed(0)),
                  duration: parseInt(duration as string),
                  bitrate,
               })
            })
         )
      }
      // Handle other cases silently
      return new Promise((resolve) => resolve({}))
   }
}
