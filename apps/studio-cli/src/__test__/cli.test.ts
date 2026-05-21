jest.mock('@quatrain/studio', () => {
   const actual = jest.requireActual('@quatrain/studio')
   const mockProjectInstance = {
      set: jest.fn(),
      save: jest.fn().mockResolvedValue(true),
      uid: 'mock-proj-123'
   }
   return {
      ...actual,
      StudioProject: {
         factory: jest.fn().mockResolvedValue(mockProjectInstance)
      },
      StudioAgent: {
         generateModelFromPrompt: jest.fn()
      },
      mockProjectInstance
   }
})

describe('Quatrain Studio CLI', () => {
   let consoleLogSpy: jest.SpyInstance
   let consoleErrorSpy: jest.SpyInstance
   let originalArgv: string[]

   beforeAll(() => {
      originalArgv = process.argv
   })

   afterAll(() => {
      process.argv = originalArgv
   })

   beforeEach(() => {
      jest.clearAllMocks()
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      // Reset require cache so index.ts parses fresh process.argv on each require
      jest.resetModules()
   })

   afterEach(() => {
      consoleLogSpy.mockRestore()
      consoleErrorSpy.mockRestore()
   })

   it('should register and execute "init" command successfully', async () => {
      process.argv = ['node', 'quatrain-studio', 'init', 'MyNewProject']
      
      // Load and parse
      require('../index')

      await new Promise(process.nextTick)

      const studioMock = require('@quatrain/studio')
      const mockProjectInstance = studioMock.mockProjectInstance

      expect(consoleLogSpy).toHaveBeenCalledWith("Initializing project 'MyNewProject'...")
      expect(studioMock.StudioProject.factory).toHaveBeenCalled()
      expect(mockProjectInstance.set).toHaveBeenCalledWith('name', 'MyNewProject')
      expect(mockProjectInstance.save).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith("Project 'MyNewProject' initialized with ID: mock-proj-123")
   })

   it('should register and execute "prompt" command successfully on AI generation success', async () => {
      const studioMock = require('@quatrain/studio')
      const mockModel = {
         val: jest.fn().mockReturnValue('User')
      }
      studioMock.StudioAgent.generateModelFromPrompt.mockResolvedValue(mockModel)

      process.argv = ['node', 'quatrain-studio', 'prompt', 'mock-proj-123', 'create user model']
      
      require('../index')

      // Give a tiny tick for async commander action to run
      await new Promise(process.nextTick)

      expect(consoleLogSpy).toHaveBeenCalledWith("Sending prompt to AI for project mock-proj-123...")
      expect(studioMock.StudioAgent.generateModelFromPrompt).toHaveBeenCalledWith('create user model', 'mock-proj-123')
      expect(consoleLogSpy).toHaveBeenCalledWith("✅ Model 'User' generated successfully!")
   })

   it('should log an error on "prompt" command failure', async () => {
      const studioMock = require('@quatrain/studio')
      studioMock.StudioAgent.generateModelFromPrompt.mockRejectedValue(new Error('AI Unavailable'))

      process.argv = ['node', 'quatrain-studio', 'prompt', 'mock-proj-123', 'create user model']
      
      require('../index')

      await new Promise(process.nextTick)

      expect(consoleLogSpy).toHaveBeenCalledWith("Sending prompt to AI for project mock-proj-123...")
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating model:', 'AI Unavailable')
   })

   it('should register and execute "generate" command successfully', async () => {
      process.argv = ['node', 'quatrain-studio', 'generate', 'mock-model-456']
      
      require('../index')

      await new Promise(process.nextTick)

      expect(consoleLogSpy).toHaveBeenCalledWith("Generating code for model mock-model-456...")
      expect(consoleLogSpy).toHaveBeenCalledWith("Code generated! (Not actually written to disk yet)")
   })
})
