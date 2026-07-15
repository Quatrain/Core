import fs from 'fs-extra';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { 
  AbstractStorageAdapter, 
  StorageParameters, 
  FileType,
  DownloadFileMetaType
} from '@quatrain/storage';

/**
 * Provides a localized file system storage backend.
 * Perfect for development or single-node deployments using local disk volumes.
 */
export class LocalStorageAdapter extends AbstractStorageAdapter {
  private basePath: string;

  constructor(parameters: StorageParameters = {}) {
    super(parameters);
    this.basePath = (parameters as any).basePath || path.resolve(process.cwd(), 'data', 'storage');
    fs.ensureDirSync(this.basePath);
  }

  /**
   * Provides direct access to the underlying `fs-extra` driver.
   * 
   * @returns The `fs` module wrapper.
   */
  getDriver(): any {
    return fs;
  }

  private _getFullPath(file: FileType): string {
    return path.join(this.basePath, file.ref);
  }

  /**
   * Writes a streaming data source directly to the local disk.
   * 
   * @param file - File footprint detailing the target path.
   * @param stream - Readable data stream.
   * @returns A promise resolving to the saved FileType metadata.
   */
  async create(file: FileType, stream: Readable): Promise<FileType> {
    const fullPath = this._getFullPath(file);
    await fs.ensureDir(path.dirname(fullPath));
    const writeStream = createWriteStream(fullPath);
    return new Promise((resolve, reject) => {
      stream.pipe(writeStream)
        .on('finish', () => resolve(file))
        .on('error', reject);
    });
  }

  /**
   * Downloads a stored file into a specific local directory (usually outside the storage pool).
   * 
   * @param file - Original file to extract.
   * @param destMeta - Destination tracking object.
   * @returns A promise resolving to the downloaded file's path.
   * @throws {Error} If the file doesn't exist.
   */
  async download(file: FileType, destMeta: DownloadFileMetaType): Promise<any> {
    const fullPath = this._getFullPath(file);
    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`File not found: ${file.ref}`);
    }
    const destPath = (destMeta as any).path || path.join(process.cwd(), 'downloads', path.basename(file.ref));
    await fs.ensureDir(path.dirname(destPath));
    await fs.copy(fullPath, destPath);
    return destPath;
  }

  /**
   * Copies a file from one storage path to another within the local disk.
   * 
   * @param file - Source footprint.
   * @param destFile - Destination footprint.
   * @returns A promise resolving to the new file footprint.
   */
  async copy(file: FileType, destFile: FileType): Promise<any> {
    const srcPath = this._getFullPath(file);
    const destPath = this._getFullPath(destFile);
    await fs.ensureDir(path.dirname(destPath));
    await fs.copy(srcPath, destPath);
    return destFile;
  }

  /**
   * Moves a file from one storage path to another within the local disk.
   * 
   * @param file - Source footprint.
   * @param destFile - Target footprint.
   * @returns A promise resolving to the relocated file footprint.
   */
  async move(file: FileType, destFile: FileType): Promise<any> {
    const srcPath = this._getFullPath(file);
    const destPath = this._getFullPath(destFile);
    await fs.ensureDir(path.dirname(destPath));
    await fs.move(srcPath, destPath);
    return destFile;
  }

  /**
   * Generates a local `file://` URI protocol link for system interoperability.
   * 
   * @param file - Target file.
   * @param expiresIn - Ignored for local files.
   * @param action - Ignored.
   * @param extra - Ignored.
   * @returns A promise resolving to the local file URI string.
   */
  async getUrl(file: FileType, expiresIn?: number, action?: string, extra?: any): Promise<any> {
    return `file://${this._getFullPath(file)}`;
  }

  /**
   * Deletes a file from the local storage volume.
   * 
   * @param file - File to delete.
   * @returns True if deleted, False if it didn't exist.
   */
  async delete(file: FileType): Promise<boolean> {
    const fullPath = this._getFullPath(file);
    if (await fs.pathExists(fullPath)) {
      await fs.remove(fullPath);
      return true;
    }
    return false;
  }

  /**
   * Creates a read stream and directly pipes it to an output (e.g. an HTTP response).
   * 
   * @param file - File to stream.
   * @param res - The writable destination pipe.
   */
  async stream(file: FileType, res: any): Promise<any> {
    const fullPath = this._getFullPath(file);
    const readStream = fs.createReadStream(fullPath);
    readStream.pipe(res);
  }

  /**
   * Bypasses standard web upload links by returning a local URI for manual OS placement.
   * 
   * @param filePath - The target file.
   * @param expiresIn - Ignored.
   * @returns A promise resolving to the file URI string.
   */
  async getUploadUrl(filePath: FileType, expiresIn?: number): Promise<any> {
    return `file://${this._getFullPath(filePath)}`;
  }

  /**
   * Initializes a Node.js Readable stream from the disk file.
   * 
   * @param file - Target file.
   * @returns A promise resolving to the `ReadStream`.
   */
  async getReadable(file: FileType): Promise<Readable> {
    const fullPath = this._getFullPath(file);
    return fs.createReadStream(fullPath);
  }

  /**
   * Retrieves basic filesystem metadata (like file size) for the specified file.
   * 
   * @param file - The target file reference.
   * @returns A promise resolving to the file object augmented with its actual byte size.
   */
  async getMetaData(file: FileType): Promise<FileType> {
    const fullPath = this._getFullPath(file);
    const stat = await fs.stat(fullPath);
    return {
      ...file,
      size: stat.size
    };
  }
}
