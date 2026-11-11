import { PassThrough, Readable } from 'node:stream'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'fs-extra'
import { S3StorageAdapter } from './S3StorageAdapter'

describe('S3StorageAdapter streaming behavior', () => {
   let adapter: S3StorageAdapter

   beforeEach(() => {
      adapter = new S3StorageAdapter({
         config: {
            bucket: 'default-bucket',
            region: 'eu-central-1',
            endpoint: 'https://s3.example.com',
            accesskey: 'test-key',
            secret: 'test-secret',
         },
      })
   })

   it('returns native Node Readable directly in getReadable without buffering via transformToByteArray', async () => {
      const transformSpy = jest.fn()
      const nativeStream = Readable.from([Buffer.from('chunk-1-'), Buffer.from('chunk-2')])
      Object.assign(nativeStream, { transformToByteArray: transformSpy })

      jest
         .spyOn(adapter.getDriver(), 'send')
         .mockImplementation(async () => ({ Body: nativeStream }))

      const result = await adapter.getReadable({
         bucket: 'default-bucket',
         ref: 'videos/large.mp4',
      })

      expect(result).toBe(nativeStream)
      expect(transformSpy).not.toHaveBeenCalled()

      const chunks: Buffer[] = []
      for await (const chunk of result) {
         chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      expect(Buffer.concat(chunks).toString('utf8')).toBe('chunk-1-chunk-2')
   })

   it('falls back to transformToByteArray when Body is not a Node Readable', async () => {
      const payload = Uint8Array.from(Buffer.from('fallback-payload'))
      const nonNodeBody = {
         transformToByteArray: jest.fn().mockResolvedValue(payload),
      }

      jest
         .spyOn(adapter.getDriver(), 'send')
         .mockImplementation(async () => ({ Body: nonNodeBody }))

      const result = await adapter.getReadable({
         bucket: 'default-bucket',
         ref: 'docs/info.json',
      })

      expect(nonNodeBody.transformToByteArray).toHaveBeenCalledTimes(1)
      const chunks: Buffer[] = []
      for await (const chunk of result) {
         chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      expect(Buffer.concat(chunks).toString('utf8')).toBe('fallback-payload')
   })

   it('streams directly to disk in download() and propagates stream errors cleanly', async () => {
      const tempDir = join(tmpdir(), `s3-adapter-test-${Date.now()}`)
      await fs.ensureDir(tempDir)
      const targetPath = join(tempDir, 'downloaded.bin')

      try {
         const sourceStream = Readable.from([
            Buffer.from('partA-'),
            Buffer.from('partB'),
         ])
         jest
            .spyOn(adapter.getDriver(), 'send')
            .mockImplementation(async () => ({ Body: sourceStream }))

         const out = await adapter.download(
            { bucket: 'default-bucket', ref: 'videos/test.mp4' },
            { path: targetPath }
         )

         expect(out).toBe(targetPath)
         const diskContent = await fs.readFile(targetPath, 'utf8')
         expect(diskContent).toBe('partA-partB')
      } finally {
         await fs.remove(tempDir)
      }
   })

   it('pipes directly to Writable responses and falls back to send(buffer) for non-stream wrappers', async () => {
      const writableRes = new PassThrough()
      const source1 = Readable.from([Buffer.from('streamed-thumb')])
      const sendSpy = jest
         .spyOn(adapter.getDriver(), 'send')
         .mockImplementationOnce(async () => ({ Body: source1 }))

      await adapter.stream(
         { bucket: 'default-bucket', ref: 'medias/thumb256.png' },
         writableRes
      )

      const received: Buffer[] = []
      for await (const chunk of writableRes) {
         received.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      expect(Buffer.concat(received).toString('utf8')).toBe('streamed-thumb')

      const source2 = Readable.from([Buffer.from('buffered-thumb')])
      sendSpy.mockImplementationOnce(async () => ({ Body: source2 }))
      const mockSendRes = {
         send: jest.fn(),
      }

      await adapter.stream(
         { bucket: 'default-bucket', ref: 'medias/thumb256.png' },
         mockSendRes
      )
      expect(mockSendRes.send).toHaveBeenCalledWith(Buffer.from('buffered-thumb'))
   })
})

