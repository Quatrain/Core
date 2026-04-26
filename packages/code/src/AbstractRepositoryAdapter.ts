export interface CommitFile {
   path: string
   content: string
}

export abstract class AbstractRepositoryAdapter {
   /**
    * Pull latest changes from remote repository
    * @param branch 
    */
   abstract pull(branch?: string): Promise<void>

   /**
    * Commit and push files to remote repository
    * @param files List of files to commit
    * @param message Commit message
    * @param branch Target branch
    */
   abstract push(files: CommitFile[], message: string, branch?: string): Promise<void>

   /**
    * Create a new branch
    * @param branchName 
    * @param fromBranch 
    */
   abstract createBranch(branchName: string, fromBranch?: string): Promise<void>
}
