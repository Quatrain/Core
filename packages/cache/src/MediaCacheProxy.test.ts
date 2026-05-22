import { MediaCacheProxy } from './MediaCacheProxy'
import { Readable } from 'stream'
import { Log } from '@quatrain/log'

describe('MediaCacheProxy', () => {
   let mockStorage: any
   let mockCache: any
   let file: any

   beforeEach(() => {
      mockStorage = {
         getReadable: jest.fn(),
      }
      mockCache = {
         getBuffer: jest.fn(),
         set: jest.fn(),
      }
      file = {
         ref: 'avatar.png',
      }
   })

   it('should return from cache on cache HIT', async () => {
      const cachedBuffer = Buffer.from('cached-media-data')
      mockCache.getBuffer.mockResolvedValueOnce(cachedBuffer)

      const proxy = new MediaCacheProxy(mockStorage, mockCache, 600)
      const debugSpy = jest.spyOn(Log, 'debug').mockImplementation(() => {})

      const result = await proxy.getMedia(file)

      expect(mockCache.getBuffer).toHaveBeenCalledWith('media:avatar.png')
      expect(mockStorage.getReadable).not.toHaveBeenCalled()
      expect(result).toBe(cachedBuffer)
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Cache HIT'))

      debugSpy.mockRestore()
   })

   it('should stream from storage on cache MISS and store in cache', async () => {
      mockCache.getBuffer.mockResolvedValueOnce(null)
      mockCache.set.mockResolvedValueOnce(undefined)

      const mediaStream = Readable.from([Buffer.from('media-chunk-1'), Buffer.from('-chunk-2')])
      mockStorage.getReadable.mockResolvedValueOnce(mediaStream)

      const proxy = new MediaCacheProxy(mockStorage, mockCache, 300)
      const debugSpy = jest.spyOn(Log, 'debug').mockImplementation(() => {})

      const result = await proxy.getMedia(file)

      expect(mockCache.getBuffer).toHaveBeenCalledWith('media:avatar.png')
      expect(mockStorage.getReadable).toHaveBeenCalledWith(file)
      expect(result.toString()).toBe('media-chunk-1-chunk-2')
      expect(mockCache.set).toHaveBeenCalledWith('media:avatar.png', result, 300)
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Cache MISS'))

      debugSpy.mockRestore()
   })

   it('should stream from storage and bypass caching if ttl is 0', async () => {
      mockCache.getBuffer.mockResolvedValueOnce(null)

      const mediaStream = Readable.from([Buffer.from('no-ttl-data')])
      mockStorage.getReadable.mockResolvedValueOnce(mediaStream)

      const proxy = new MediaCacheProxy(mockStorage, mockCache, 0)
      const result = await proxy.getMedia(file)

      expect(result.toString()).toBe('no-ttl-data')
      expect(mockCache.set).not.toHaveBeenCalled()
   })

   it('should handle cache read failures safely by falling back to storage', async () => {
      const cacheError = new Error('Redis down')
      mockCache.getBuffer.mockRejectedValueOnce(cacheError)

      const mediaStream = Readable.from([Buffer.from('fallback-data')])
      mockStorage.getReadable.mockResolvedValueOnce(mediaStream)
      mockCache.set.mockResolvedValueOnce(undefined)

      const proxy = new MediaCacheProxy(mockStorage, mockCache, 600)
      const warnSpy = jest.spyOn(Log, 'warn').mockImplementation(() => {})

      const result = await proxy.getMedia(file)

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to read from Cache'))
      expect(result.toString()).toBe('fallback-data')
      expect(mockStorage.getReadable).toHaveBeenCalledWith(file)

      warnSpy.mockRestore()
   })

   it('should handle cache write failures safely without raising errors', async () => {
      mockCache.getBuffer.mockResolvedValueOnce(null)

      const mediaStream = Readable.from([Buffer.from('write-fail-data')])
      mockStorage.getReadable.mockResolvedValueOnce(mediaStream)

      const writeError = new Error('Write forbidden')
      mockCache.set.mockRejectedValueOnce(writeError)

      const proxy = new MediaCacheProxy(mockStorage, mockCache, 600)
      const warnSpy = jest.spyOn(Log, 'warn').mockImplementation(() => {})

      const result = await proxy.getMedia(file)

      // Wait a tick for async .catch on .set to run
      await new Promise(process.nextTick)

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to write cache'))
      expect(result.toString()).toBe('write-fail-data')

      warnSpy.mockRestore()
   })

   it('should propagate storage stream read errors', async () => {
      mockCache.getBuffer.mockResolvedValueOnce(null)

      const failingStream = new Readable({
         read() {
            this.emit('error', new Error('Storage read timeout'))
         },
      })
      mockStorage.getReadable.mockResolvedValueOnce(failingStream)

      const proxy = new MediaCacheProxy(mockStorage, mockCache, 600)
      await expect(proxy.getMedia(file)).rejects.toThrow('Storage read timeout')
   })
})
