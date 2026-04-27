import * as fs from 'fs-extra';
import * as path from 'path';
import { 
  AbstractStorageAdapter, 
  StorageParameters, 
  BlobType, 
  DownloadFileMetaType,
  FileResponseLinkType,
  FileType
} from '@quatrain/storage';

export class LocalStorageAdapter extends AbstractStorageAdapter {
  private basePath: string;

  constructor(parameters: StorageParameters) {
    super(parameters);
    this.basePath = parameters.basePath || path.resolve(process.cwd(), 'data', 'storage');
    fs.ensureDirSync(this.basePath);
  }

  public async getStorageId(): Promise<string> {
    return `local:${this.basePath}`;
  }

  public async isExists(filePath: string): Promise<boolean> {
    return fs.pathExists(path.join(this.basePath, filePath));
  }

  public async getFileInfo(filePath: string): Promise<any> {
    const fullPath = path.join(this.basePath, filePath);
    if (!(await fs.pathExists(fullPath))) {
      return null;
    }
    const stat = await fs.stat(fullPath);
    return {
      size: stat.size,
      lastModified: stat.mtime
    };
  }

  public async put(filePath: string, fileData: BlobType, metaData: any = {}): Promise<FileResponseLinkType> {
    const fullPath = path.join(this.basePath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, fileData);
    
    return {
      link: filePath,
      status: 'success'
    };
  }

  public async putLink(filePath: string, fileLink: string, metaData: any = {}): Promise<FileResponseLinkType> {
    return this.put(filePath, await fs.readFile(fileLink), metaData);
  }

  public async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    if (await fs.pathExists(fullPath)) {
      await fs.remove(fullPath);
    }
  }

  public async listDirectory(directory: string): Promise<any> {
    const fullDir = path.join(this.basePath, directory);
    if (!(await fs.pathExists(fullDir))) {
      return [];
    }
    const files = await fs.readdir(fullDir);
    return files;
  }

  public async getAsBuffer(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, filePath);
    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFile(fullPath);
  }

  public async get(filePath: string): Promise<DownloadFileMetaType> {
    const buffer = await this.getAsBuffer(filePath);
    return {
      buffer,
      type: 'application/octet-stream', // Could be improved with mime type detection
      size: buffer.length
    };
  }
}
