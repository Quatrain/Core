import { 
   AbstractStorageAdapter, 
   StorageParameters, 
   FileType,
   DownloadFileMetaType,
   BucketStatsType
} from '@quatrain/storage';
import { Octokit } from '@octokit/rest';
import { Readable } from 'node:stream';
import fs from 'fs-extra';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execPromise = promisify(exec);

export interface GitStorageConfig {
   mode: 'local' | 'github';
   localPath?: string;       // path to local git repo clone
   githubToken?: string;     // Personal Access Token
   owner?: string;           // GitHub repo owner
   repo?: string;            // GitHub repository name
   branch?: string;          // default: 'main'
   noPush?: boolean;         // disable push on save/delete in local mode
}

/**
 * Git and GitHub Storage Adapter for Quatrain Core.
 * Manages files locally via Git shell execution, or remotely via the GitHub REST API.
 */
export class GitStorageAdapter extends AbstractStorageAdapter {
   protected config: GitStorageConfig;
   protected octokit: Octokit | null = null;

   constructor(parameters: StorageParameters = {}) {
      super(parameters);
      this.config = (parameters.config as GitStorageConfig) || { mode: 'local' };
      if (!this.config.branch) {
         this.config.branch = 'main';
      }

      if (this.config.mode === 'github') {
         if (!this.config.githubToken || !this.config.owner || !this.config.repo) {
            throw new Error('[GitStorage] GitHub token, owner, and repo must be provided in github mode');
         }
         this.octokit = new Octokit({ auth: this.config.githubToken });
      } else if (this.config.mode === 'local') {
         if (!this.config.localPath) {
            this.config.localPath = process.cwd();
         }
         fs.ensureDirSync(this.config.localPath);
      }
   }

   /**
    * Returns the underlying SDK or driver instance (Octokit for GitHub, fs-extra for local).
    * 
    * @returns The raw storage client or file system module.
    */
   getDriver(): any {
      return this.config.mode === 'github' ? this.octokit : fs;
   }

   protected async runGit(cmd: string) {
      if (this.config.mode === 'local' && this.config.localPath) {
         try {
            await execPromise(cmd, { cwd: this.config.localPath });
         } catch (err: any) {
            const msg = err.message || '';
            if (!msg.includes('index.lock') && !msg.includes('EBADF')) {
               console.warn(`[GitStorage] Git command failed: ${cmd}. Error: ${msg}`);
            }
         }
      }
   }

   protected async streamToString(stream: Readable): Promise<string> {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
         chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString('utf-8');
   }

   /**
    * Creates a new file or updates an existing one in the git repository or GitHub.
    * 
    * @param file - Target file metadata.
    * @param stream - Readable stream containing the file content.
    * @returns A promise resolving to the created file's metadata footprint.
    */
   async create(file: FileType, stream: Readable): Promise<FileType> {
      const content = await this.streamToString(stream);

      if (this.config.mode === 'github' && this.octokit) {
         let sha: string | undefined = undefined;
         try {
            const { data } = await this.octokit.repos.getContent({
               owner: this.config.owner!,
               repo: this.config.repo!,
               path: file.ref,
               ref: this.config.branch
            });
            if (data && !Array.isArray(data)) {
               sha = data.sha;
            }
         } catch (e) {
            // File does not exist yet
         }

         await this.octokit.repos.createOrUpdateFileContents({
            owner: this.config.owner!,
            repo: this.config.repo!,
            path: file.ref,
            message: `Update ${file.ref}`,
            content: Buffer.from(content).toString('base64'),
            branch: this.config.branch,
            sha
         });
      } else {
         const fullPath = path.join(this.config.localPath!, file.ref);
         await fs.ensureDir(path.dirname(fullPath));
         await fs.writeFile(fullPath, content, 'utf-8');

         // Commit and push locally
         const gitCmd = this.config.noPush
            ? `git add "${file.ref}" && git commit -m "Update ${file.ref}"`
            : `git add "${file.ref}" && git commit -m "Update ${file.ref}" && git push`;
         await this.runGit(gitCmd);
      }

      return {
         ...file,
         size: Buffer.byteLength(content)
      };
   }

   /**
    * Retrieves the file content as a Readable stream.
    * 
    * @param file - Target file footprint.
    * @returns A promise resolving to a Node Readable stream.
    */
   async getReadable(file: FileType): Promise<Readable> {
      if (this.config.mode === 'github' && this.octokit) {
         const { data } = await this.octokit.repos.getContent({
            owner: this.config.owner!,
            repo: this.config.repo!,
            path: file.ref,
            ref: this.config.branch
         });

         if (data && !Array.isArray(data) && 'content' in data) {
            const raw = Buffer.from(data.content, 'base64').toString('utf-8');
            return Readable.from([raw]);
         }
         throw new Error(`[GitStorage] Failed to read file ${file.ref} from GitHub`);
      } else {
         const fullPath = path.join(this.config.localPath!, file.ref);
         if (!(await fs.pathExists(fullPath))) {
            throw new Error(`[GitStorage] File not found: ${file.ref}`);
         }
         return fs.createReadStream(fullPath);
      }
   }

   /**
    * Deletes a file from the repository and commits/pushes the change.
    * 
    * @param file - Target file footprint.
    * @returns A promise resolving to true if the file was deleted, false otherwise.
    */
   async delete(file: FileType): Promise<boolean> {
      if (this.config.mode === 'github' && this.octokit) {
         try {
            const { data } = await this.octokit.repos.getContent({
               owner: this.config.owner!,
               repo: this.config.repo!,
               path: file.ref,
               ref: this.config.branch
            });

            if (data && !Array.isArray(data)) {
               await this.octokit.repos.deleteFile({
                  owner: this.config.owner!,
                  repo: this.config.repo!,
                  path: file.ref,
                  message: `Delete ${file.ref}`,
                  sha: data.sha,
                  branch: this.config.branch
               });
               return true;
            }
         } catch (e) {
            return false;
         }
         return false;
      } else {
         const fullPath = path.join(this.config.localPath!, file.ref);
         if (await fs.pathExists(fullPath)) {
            await fs.remove(fullPath);
            const gitCmd = this.config.noPush
               ? `git rm "${file.ref}" && git commit -m "Delete ${file.ref}"`
               : `git rm "${file.ref}" && git commit -m "Delete ${file.ref}" && git push`;
            await this.runGit(gitCmd);
            return true;
         }
         return false;
      }
   }

   /**
    * Lists all files within the repository that match the prefix.
    * 
    * @param prefixOrOptions - Root prefix directory or options object.
    * @returns A promise resolving to a list of matching file reference paths.
    */
   async list(prefixOrOptions: any = ''): Promise<string[]> {
      const prefix = typeof prefixOrOptions === 'object' && prefixOrOptions !== null 
         ? (prefixOrOptions.prefix || '') 
         : (prefixOrOptions || '');

      if (this.config.mode === 'github' && this.octokit) {
         try {
            const { data } = await this.octokit.git.getTree({
               owner: this.config.owner!,
               repo: this.config.repo!,
               tree_sha: this.config.branch!,
               recursive: 'true'
            });

            const cleanPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
            return data.tree
               .filter(item => item.path && (item.path === prefix || item.path.startsWith(cleanPrefix)) && item.type === 'blob')
               .map(item => item.path as string);
         } catch (err) {
            return [];
         }
      } else {
         const dir = path.join(this.config.localPath!, prefix);
         const files: string[] = [];
         
         const scan = async (d: string) => {
            try {
               const entries = await fs.readdir(d, { withFileTypes: true });
               for (const entry of entries) {
                  const fullPath = path.join(d, entry.name);
                  if (entry.isDirectory()) {
                     await scan(fullPath);
                  } else if (entry.isFile()) {
                     files.push(path.relative(this.config.localPath!, fullPath));
                  }
               }
            } catch (e) {
               // ignore missing dir
            }
         };

         await scan(dir);
         return files;
      }
   }

   /**
    * Downloads a stored file to a specific local path.
    * 
    * @param file - Target file footprint.
    * @param destMeta - Destination file path configuration.
    * @returns A promise resolving to the final local destination path.
    */
   async download(file: FileType, destMeta: DownloadFileMetaType): Promise<any> {
      const stream = await this.getReadable(file);
      const content = await this.streamToString(stream);
      const destPath = (destMeta as any).path || path.join(process.cwd(), 'downloads', path.basename(file.ref));
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, content);
      return destPath;
   }

   /**
    * Copies a file from one repository location to another.
    * 
    * @param file - Source file footprint.
    * @param destFile - Destination file footprint.
    * @returns A promise resolving to the copied file metadata.
    */
   async copy(file: FileType, destFile: FileType): Promise<any> {
      const stream = await this.getReadable(file);
      await this.create(destFile, stream);
      return destFile;
   }

   /**
    * Moves/renames a file natively in the repository.
    * 
    * @param file - Source file footprint.
    * @param destFile - Destination file footprint.
    * @returns A promise resolving to the relocated file footprint.
    */
   async move(file: FileType, destFile: FileType): Promise<any> {
      await this.copy(file, destFile);
      await this.delete(file);
      return destFile;
   }

   /**
    * Generates a raw URL pointing to the raw file content in Git/GitHub.
    * 
    * @param file - Target file footprint.
    * @param expiresIn - Expiry window in seconds (ignored).
    * @param action - Action intent (ignored).
    * @param extra - Provider specific overrides (ignored).
    * @returns A promise resolving to the final raw public URL string.
    */
   async getUrl(file: FileType, expiresIn?: number, action?: string, extra?: any): Promise<any> {
      if (this.config.mode === 'github') {
         return `https://raw.githubusercontent.com/${this.config.owner}/${this.config.repo}/${this.config.branch}/${file.ref}`;
      }
      return `file://${path.join(this.config.localPath!, file.ref)}`;
   }

   /**
    * Generates a direct upload URL (returns the read URL since git upload is committed directly).
    * 
    * @param filePath - Target file footprint.
    * @param expiresIn - Expiry window in seconds (ignored).
    * @returns A promise resolving to the raw URL string.
    */
   async getUploadUrl(filePath: FileType, expiresIn?: number): Promise<any> {
      return this.getUrl(filePath);
   }

   /**
    * Pipes the file content directly into a writable stream.
    * 
    * @param file - Target file footprint.
    * @param res - Target writable stream.
    */
   async stream(file: FileType, res: any): Promise<any> {
      const stream = await this.getReadable(file);
      stream.pipe(res);
   }

   /**
    * Retrieves file metadata, specifically augmenting it with byte size.
    * 
    * @param file - Target file footprint.
    * @returns A promise resolving to the file footprint containing sizes.
    */
   async getMetaData(file: FileType): Promise<FileType> {
      if (this.config.mode === 'github' && this.octokit) {
         const { data } = await this.octokit.repos.getContent({
            owner: this.config.owner!,
            repo: this.config.repo!,
            path: file.ref,
            ref: this.config.branch
         });
         if (data && !Array.isArray(data)) {
            return {
               ...file,
               size: data.size
            };
         }
      } else {
         const fullPath = path.join(this.config.localPath!, file.ref);
         if (await fs.pathExists(fullPath)) {
            const stat = await fs.stat(fullPath);
            return {
               ...file,
               size: stat.size
            };
         }
      }
      return file;
   }

   /**
    * Computes statistics for the Git repository storage.
    * 
    * @param bucket - Optional bucket name (defaults to 'default').
    * @param prefix - Optional directory prefix to scan.
    * @returns A promise resolving to the bucket statistics.
    */
   async getBucketStats(bucket?: string, prefix?: string): Promise<BucketStatsType> {
      const files = await this.list(prefix || '');
      return {
         bucket: bucket || 'default',
         totalObjects: files.length,
         totalSize: 0,
         folders: {}
      };
   }
}
