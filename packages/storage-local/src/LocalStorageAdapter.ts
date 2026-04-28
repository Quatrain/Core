import * as fs from 'fs-extra';
import * as path from 'path';
import { Readable } from 'stream';
import { 
  AbstractStorageAdapter, 
  StorageParameters, 
  FileType,
  DownloadFileMetaType
} from '@quatrain/storage';

export class LocalStorageAdapter extends AbstractStorageAdapter {
  private basePath: string;

  constructor(parameters: StorageParameters = {}) {
    super(parameters);
    this.basePath = (parameters as any).basePath || path.resolve(process.cwd(), 'data', 'storage');
    fs.ensureDirSync(this.basePath);
  }

  getDriver(): any {
    return fs;
  }

  private _getFullPath(file: FileType): string {
    return path.join(this.basePath, file.ref);
  }

  async create(file: FileType, stream: Readable): Promise<FileType> {
    const fullPath = this._getFullPath(file);
    await fs.ensureDir(path.dirname(fullPath));
    const writeStream = fs.createWriteStream(fullPath);
    return new Promise((resolve, reject) => {
      stream.pipe(writeStream)
        .on('finish', () => resolve(file))
        .on('error', reject);
    });
  }

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

  async copy(file: FileType, destFile: FileType): Promise<any> {
    const srcPath = this._getFullPath(file);
    const destPath = this._getFullPath(destFile);
    await fs.ensureDir(path.dirname(destPath));
    await fs.copy(srcPath, destPath);
    return destFile;
  }

  async move(file: FileType, destFile: FileType): Promise<any> {
    const srcPath = this._getFullPath(file);
    const destPath = this._getFullPath(destFile);
    await fs.ensureDir(path.dirname(destPath));
    await fs.move(srcPath, destPath);
    return destFile;
  }

  async getUrl(file: FileType, expiresIn?: number, action?: string, extra?: any): Promise<any> {
    return `file://${this._getFullPath(file)}`;
  }

  async delete(file: FileType): Promise<boolean> {
    const fullPath = this._getFullPath(file);
    if (await fs.pathExists(fullPath)) {
      await fs.remove(fullPath);
      return true;
    }
    return false;
  }

  async stream(file: FileType, res: any): Promise<any> {
    const fullPath = this._getFullPath(file);
    const readStream = fs.createReadStream(fullPath);
    readStream.pipe(res);
  }

  async getUploadUrl(filePath: FileType, expiresIn?: number): Promise<any> {
    return `file://${this._getFullPath(filePath)}`;
  }

  async getReadable(file: FileType): Promise<Readable> {
    const fullPath = this._getFullPath(file);
    return fs.createReadStream(fullPath);
  }

  async getMetaData(file: FileType): Promise<FileType> {
    const fullPath = this._getFullPath(file);
    const stat = await fs.stat(fullPath);
    return {
      ...file,
      size: stat.size
    };
  }
}
