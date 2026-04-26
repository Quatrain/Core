import { GithubAdapter } from '../GithubAdapter'

jest.mock('@octokit/rest', () => ({
   Octokit: jest.fn().mockImplementation(() => ({
      repos: {
         get: jest.fn().mockResolvedValue({ data: {} })
      },
      git: {
         getRef: jest.fn().mockResolvedValue({ data: { object: { sha: 'base-sha' } } }),
         getCommit: jest.fn().mockResolvedValue({ data: { tree: { sha: 'tree-sha' } } }),
         createBlob: jest.fn().mockResolvedValue({ data: { sha: 'blob-sha' } }),
         createTree: jest.fn().mockResolvedValue({ data: { sha: 'new-tree-sha' } }),
         createCommit: jest.fn().mockResolvedValue({ data: { sha: 'new-commit-sha' } }),
         updateRef: jest.fn().mockResolvedValue({ data: {} }),
         createRef: jest.fn().mockResolvedValue({ data: {} })
      }
   }))
}))

describe('GithubAdapter', () => {
   let adapter: GithubAdapter

   beforeEach(() => {
      adapter = new GithubAdapter('fake-token', 'owner', 'repo')
   })

   it('should fetch repo on pull', async () => {
      await expect(adapter.pull('main')).resolves.not.toThrow()
   })

   it('should push files', async () => {
      await expect(adapter.push([{ path: 'test.txt', content: 'hello' }], 'commit msg')).resolves.not.toThrow()
   })

   it('should create branch', async () => {
      await expect(adapter.createBranch('new-feature')).resolves.not.toThrow()
   })
})
