import { Helpers } from './Helpers'
import { Worker } from './Worker'

jest.mock('./Worker', () => {
   const original = jest.requireActual('./Worker')
   return {
      Worker: {
         ...original.Worker,
         getSystemCommandPath: jest.fn().mockResolvedValue('/usr/bin/ffmpeg'),
         execPromise: jest.fn().mockResolvedValue(true),
         info: jest.fn(),
      }
   }
})

describe('Helpers', () => {
   beforeEach(() => {
      jest.clearAllMocks()
   })

   it('should generate video thumbnail parameters correctly and execute ffmpeg', async () => {
      const videoPath = 'test.mp4'
      const outputPath = 'output.jpg'
      
      const result = await Helpers.generateVideoThumbnail(videoPath, outputPath, 5, 640)
      
      expect(result).toBe(true)
      expect(Worker.execPromise).toHaveBeenCalledWith('/usr/bin/ffmpeg', [
         '-i',
         'test.mp4',
         '-vframes',
         '1',
         '-vf',
         'select=gte(n\\,5)',
         '-s',
         '640x480',
         '-ss',
         '1',
         'output.jpg',
         '-y'
      ])
   })

   it('should use default values for frame and width', async () => {
      const videoPath = 'test.mp4'
      const outputPath = 'output.jpg'
      
      const result = await Helpers.generateVideoThumbnail(videoPath, outputPath)
      
      expect(result).toBe(true)
      expect(Worker.execPromise).toHaveBeenCalledWith('/usr/bin/ffmpeg', [
         '-i',
         'test.mp4',
         '-vframes',
         '1',
         '-vf',
         'select=gte(n\\,0)',
         '-s',
         '320x240',
         '-ss',
         '1',
         'output.jpg',
         '-y'
      ])
   })
})
