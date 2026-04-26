import { AbstractRepositoryAdapter, CommitFile } from '../AbstractRepositoryAdapter'
import { CodeRepository } from '../CodeRepository'

class MockRepoAdapter extends AbstractRepositoryAdapter {
   async pull() {}
   async push(files: CommitFile[], message: string) {}
   async createBranch(branchName: string) {}
}

describe('CodeRepository Singleton', () => {
   it('should throw an error if no adapter is set', () => {
      // @ts-ignore : private property access for test reset
      CodeRepository._adapter = null
      expect(() => CodeRepository.getAdapter()).toThrow()
   })

   it('should set and get the adapter successfully', () => {
      const adapter = new MockRepoAdapter()
      CodeRepository.setAdapter(adapter)
      expect(CodeRepository.getAdapter()).toBe(adapter)
   })
})
