import { CoreList } from './decorator'

describe('CoreList Decorator', () => {
   it('should bind configuration onto target class and prototype', () => {
      const config = { endpoint: 'users', pagesize: 10 }
      
      @CoreList(config)
      class TestClass {}

      expect((TestClass as any).listConfig).toBe(config)
      expect((TestClass.prototype as any).listConfig).toBe(config)
   })
})
