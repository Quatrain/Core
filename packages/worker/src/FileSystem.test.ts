import fs from 'node:fs'
import path from 'node:path'
import { FileSystem } from './FileSystem'
import axios from 'axios'
import fetch from 'node-fetch-native'
import * as ffmpeg from 'fluent-ffmpeg'
import { PassThrough, Readable } from 'node:stream'

jest.mock('axios')
jest.mock('node-fetch-native')
jest.mock('fluent-ffmpeg', () => ({
   ffprobe: jest.fn()
}))

// Mock @quatrain/log globally to completely silence all logging calls across the monorepo graph during worker tests.
// Returns a valid dummy logger object to satisfy Core.addLogger and Worker.addLogger definitions.
jest.mock('@quatrain/log', () => {
   const dummyLoggerInstance = {
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
   }
   return {
      Log: {
         info: jest.fn(),
         debug: jest.fn(),
         error: jest.fn(),
         warn: jest.fn(),
         addLogger: jest.fn().mockReturnValue(dummyLoggerInstance)
      },
      LogLevel: {
         INFO: 1,
         DEBUG: 0,
         ERROR: 3,
         WARN: 2
      },
      DefaultLoggerAdapter: jest.fn().mockImplementation(() => dummyLoggerInstance)
   }
})

const originalExistsSync = fs.existsSync

describe('FileSystem Utilities (Worker)', () => {
   const testBaseDir = path.resolve(__dirname, 'temp_test_dir')

   beforeEach(() => {
      // Mock createWriteStream and createReadStream to return in-memory streams.
      // This completely prevents physical file descriptor locks and background ENOENT races.
      jest.spyOn(fs, 'createWriteStream').mockImplementation(() => {
         return new PassThrough() as any
      })

      jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
         return Readable.from(Buffer.alloc(35 * 1024)) as any
      })

      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
         if (typeof p === 'string' && (p.endsWith('test.txt') || p.endsWith('small.mp4') || p.endsWith('large.mp4') || p.endsWith('large-fail.mp4'))) {
            return true
         }
         return originalExistsSync(p)
      })

      jest.spyOn(fs, 'statSync').mockImplementation((p) => {
         if (typeof p === 'string') {
            if (p.endsWith('small.mp4')) {
               return { size: 13 } as any
            }
            if (p.endsWith('large.mp4') || p.endsWith('large-fail.mp4')) {
               return { size: 35 * 1024 } as any
            }
         }
         return (jest.requireActual('node:fs').statSync)(p)
      })

      // Setup base temp folder if needed
      if (originalExistsSync(testBaseDir)) {
         fs.rmSync(testBaseDir, { recursive: true, force: true })
      }
   })

   afterEach(() => {
      // Clean up base temp folder
      if (originalExistsSync(testBaseDir)) {
         fs.rmSync(testBaseDir, { recursive: true, force: true })
      }
      jest.clearAllMocks()
      jest.restoreAllMocks()
   })

   describe('prepare and Directory Actions', () => {
      it('should prepare standard workspace layouts', () => {
         // Restore real fs methods for actual directory testing
         jest.restoreAllMocks()
         FileSystem.prepare(testBaseDir)

         expect(fs.existsSync(testBaseDir)).toBe(true)
         expect(fs.existsSync(path.join(testBaseDir, 'images'))).toBe(true)
         expect(fs.existsSync(path.join(testBaseDir, 'vecto'))).toBe(true)
      })

      it('should create directories using makeFolder', () => {
         jest.restoreAllMocks()
         fs.mkdirSync(testBaseDir)
         const subDir = path.join(testBaseDir, 'custom')
         FileSystem.makeFolder(subDir)
         expect(fs.existsSync(subDir)).toBe(true)
      })

      it('should recursively clear directories', () => {
         jest.restoreAllMocks()
         FileSystem.prepare(testBaseDir)
         const sub = path.join(testBaseDir, 'images', 'nested')
         fs.mkdirSync(sub)
         fs.writeFileSync(path.join(sub, 'file.txt'), 'hello')
         fs.writeFileSync(path.join(testBaseDir, 'rootfile.txt'), 'world')

         expect(fs.existsSync(sub)).toBe(true)

         FileSystem.removeFolder(testBaseDir, true)
         expect(fs.existsSync(testBaseDir)).toBe(false)
      })

      it('should throw an error on non-recursive deletion containing directories', () => {
         jest.restoreAllMocks()
         fs.mkdirSync(testBaseDir)
         fs.mkdirSync(path.join(testBaseDir, 'nested'))

         expect(() => FileSystem.removeFolder(testBaseDir, false)).toThrow('Folder contains folder')
      })
   })

   describe('downloadFile', () => {
      it('should download files to target local paths', async () => {
         const mockStream = {
            pipe: jest.fn((writer) => {
               process.nextTick(() => {
                  writer.end()
               })
            })
         };

         (axios.get as jest.Mock).mockResolvedValue({
            data: mockStream
         })

         const filepath = path.join(testBaseDir, 'test.txt')

         const result = await FileSystem.downloadFile('https://example.com/test.txt', filepath)
         expect(result).toBe(true)
         expect(axios.get).toHaveBeenCalledWith('https://example.com/test.txt', {
            responseType: 'stream'
         })
         expect(fs.existsSync(filepath)).toBe(true)
      })

      it('should catch and propagate download failures', async () => {
         (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'))

         const filepath = path.join(testBaseDir, 'test.txt')

         await expect(FileSystem.downloadFile('https://example.com/test.txt', filepath)).rejects.toThrow('Network error')
      })
   })

   describe('safeString', () => {
      it('should convert spaces to underscores', () => {
         expect(FileSystem.safeString('hello world  test')).toBe('hello_world_test')
         expect(FileSystem.safeString('clean-name')).toBe('clean-name')
      })
   })

   describe('getInfo (Media probe)', () => {
      it('should resolve metadata from video extensions', async () => {
         const mockMetadata = {
            streams: [
               {
                  width: 1920,
                  height: 1080,
                  duration: '10.5',
                  bit_rate: '5000',
                  nb_frames: '300'
               }
            ]
         };

         (ffmpeg.ffprobe as any).mockImplementation((file: string, callback: any) => {
            callback(null, mockMetadata)
         })

         const info = await FileSystem.getInfo('video.mp4')
         expect(info).toEqual({
            width: 1920,
            height: 1080,
            framerate: 29,
            duration: 10,
            bitrate: '5000'
         })
      })

      it('should bypass non-video extensions silently', async () => {
         const info = await FileSystem.getInfo('document.pdf')
         expect(info).toEqual({})
      })

      it('should bubble up probe errors', async () => {
         (ffmpeg.ffprobe as any).mockImplementation((file: string, callback: any) => {
            callback(new Error('Probe failed'))
         })

         await expect(FileSystem.getInfo('video.mp4')).rejects.toThrow('Probe failed')
      })
   })

   describe('uploadFile', () => {
      it('should upload small files (< 32KB) using full read buffers', async () => {
         const testFile = path.join(testBaseDir, 'small.mp4')

         const mockMetadata = {
            streams: [{ width: 320, height: 240, duration: '1', bit_rate: '100', nb_frames: '10' }]
         };
         (ffmpeg.ffprobe as any).mockImplementation((file: string, callback: any) => {
            callback(null, mockMetadata)
         });

         (fetch as any).mockResolvedValue({
            ok: true
         })

         // Stub readFileSync for small content read
         jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('small content'))

         const meta = {
            ref: 'remote/small.mp4',
            uploadUrl: 'https://upload.com/small.mp4'
         }

         const result = await FileSystem.uploadFile(testFile, meta)
         expect(result.size).toBe(13)
         expect(result.width).toBe(320)
         expect(result.uploadUrl).toBeUndefined()
         expect(fetch).toHaveBeenCalledWith('https://upload.com/small.mp4', expect.any(Object))
      })

      it('should upload large files (>= 32KB) using readable streams', async () => {
         const testFile = path.join(testBaseDir, 'large.mp4')

         const mockMetadata = {
            streams: [{ width: 1280, height: 720, duration: '5', bit_rate: '2000', nb_frames: '150' }]
         };
         (ffmpeg.ffprobe as any).mockImplementation((file: string, callback: any) => {
            callback(null, mockMetadata)
         });

         (fetch as any).mockResolvedValue({
            ok: true
         })

         const meta = {
            ref: 'remote/large.mp4',
            uploadUrl: 'https://upload.com/large.mp4'
         }

         const result = await FileSystem.uploadFile(testFile, meta)
         expect(result.size).toBe(35 * 1024)
         expect(result.uploadUrl).toBeUndefined()
         expect(fetch).toHaveBeenCalledWith('https://upload.com/large.mp4', expect.any(Object))
      })

      it('should reject large uploads if HTTP request fails', async () => {
         const testFile = path.join(testBaseDir, 'large-fail.mp4')

         const mockMetadata = {
            streams: [{ width: 1280, height: 720, duration: '5', bit_rate: '2000', nb_frames: '150' }]
         };
         (ffmpeg.ffprobe as any).mockImplementation((file: string, callback: any) => {
            callback(null, mockMetadata)
         });

         (fetch as any).mockRejectedValue(new Error('Connection abort'))

         const meta = {
            ref: 'remote/large-fail.mp4',
            uploadUrl: 'https://upload.com/large-fail.mp4'
         }

         await expect(FileSystem.uploadFile(testFile, meta)).rejects.toThrow('Connection abort')
      })
   })
})
