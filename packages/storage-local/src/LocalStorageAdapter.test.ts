import { LocalStorageAdapter } from './LocalStorageAdapter';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'fs-extra';
import { Readable, Writable } from 'node:stream';
import { StorageParameters, FileType } from '@quatrain/storage';

describe('LocalStorageAdapter', () => {
  let tempDir: string;
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    // Create a unique temporary directory for each test run to avoid collision
    tempDir = path.join(os.tmpdir(), 'quatrain-storage-local-test', Math.random().toString(36).substring(7));
    await fs.ensureDir(tempDir);
    const params = {
      config: { bucket: 'test-bucket' },
      basePath: tempDir
    };
    adapter = new LocalStorageAdapter(params as any);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  it('should construct with default path if no parameter is provided', () => {
    const params = {
      config: { bucket: 'default-bucket' }
    };
    const defaultAdapter = new LocalStorageAdapter(params as any);
    expect(defaultAdapter.getDriver()).toBeDefined();
    expect(defaultAdapter.getDriver().ensureDir).toBeInstanceOf(Function);
  });

  it('should return fs driver via getDriver', () => {
    expect(adapter.getDriver()).toBeDefined();
    expect(adapter.getDriver().ensureDir).toBeInstanceOf(Function);
  });

  it('should create a file from stream', async () => {
    const fileMeta: FileType = { bucket: 'test-bucket', ref: 'subfolder/test.txt', contentType: 'text/plain' };
    const content = 'hello local storage';
    const stream = Readable.from([content]);

    const result = await adapter.create(fileMeta, stream);
    expect(result.ref).toBe('subfolder/test.txt');

    const filePath = path.join(tempDir, 'subfolder/test.txt');
    expect(await fs.pathExists(filePath)).toBe(true);
    expect(await fs.readFile(filePath, 'utf8')).toBe(content);
  });

  it('should download a file to local downloads folder', async () => {
    const fileMeta: FileType = { bucket: 'test-bucket', ref: 'test-download.txt', contentType: 'text/plain' };
    const content = 'download me';
    const filePath = path.join(tempDir, 'test-download.txt');
    await fs.outputFile(filePath, content);

    const destMetaPath = path.join(tempDir, 'downloads', 'output.txt');
    const downloadedPath = await adapter.download(fileMeta, { path: destMetaPath });

    expect(downloadedPath).toBe(destMetaPath);
    expect(await fs.pathExists(destMetaPath)).toBe(true);
    expect(await fs.readFile(destMetaPath, 'utf8')).toBe(content);
  });

  it('should throw error when downloading a non-existent file', async () => {
    const fileMeta: FileType = { bucket: 'test-bucket', ref: 'missing.txt', contentType: 'text/plain' };
    await expect(adapter.download(fileMeta, { path: 'any' })).rejects.toThrow('File not found: missing.txt');
  });

  it('should copy a file successfully', async () => {
    const srcMeta: FileType = { bucket: 'test-bucket', ref: 'src.txt', contentType: 'text/plain' };
    const destMeta: FileType = { bucket: 'test-bucket', ref: 'copied/dest.txt', contentType: 'text/plain' };
    await fs.outputFile(path.join(tempDir, 'src.txt'), 'hello world');

    const result = await adapter.copy(srcMeta, destMeta);
    expect(result.ref).toBe('copied/dest.txt');
    expect(await fs.readFile(path.join(tempDir, 'copied/dest.txt'), 'utf8')).toBe('hello world');
  });

  it('should move a file successfully', async () => {
    const srcMeta: FileType = { bucket: 'test-bucket', ref: 'src-move.txt', contentType: 'text/plain' };
    const destMeta: FileType = { bucket: 'test-bucket', ref: 'moved/dest.txt', contentType: 'text/plain' };
    await fs.outputFile(path.join(tempDir, 'src-move.txt'), 'moving content');

    const result = await adapter.move(srcMeta, destMeta);
    expect(result.ref).toBe('moved/dest.txt');
    expect(await fs.pathExists(path.join(tempDir, 'src-move.txt'))).toBe(false);
    expect(await fs.readFile(path.join(tempDir, 'moved/dest.txt'), 'utf8')).toBe('moving content');
  });

  it('should generate URL and Upload URL', async () => {
    const fileMeta: FileType = { bucket: 'test-bucket', ref: 'url.txt', contentType: 'text/plain' };
    const url = await adapter.getUrl(fileMeta);
    const uploadUrl = await adapter.getUploadUrl(fileMeta);

    expect(url).toBe(`file://${path.join(tempDir, 'url.txt')}`);
    expect(uploadUrl).toBe(`file://${path.join(tempDir, 'url.txt')}`);
  });

  it('should delete a file and return true, or false if it does not exist', async () => {
    const fileMeta: FileType = { bucket: 'test-bucket', ref: 'to-delete.txt', contentType: 'text/plain' };
    expect(await adapter.delete(fileMeta)).toBe(false);

    await fs.outputFile(path.join(tempDir, 'to-delete.txt'), 'delete-me');
    expect(await adapter.delete(fileMeta)).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, 'to-delete.txt'))).toBe(false);
  });

  it('should stream a file content to writable target', async () => {
    const fileMeta: FileType = { bucket: 'test-bucket', ref: 'stream.txt', contentType: 'text/plain' };
    await fs.outputFile(path.join(tempDir, 'stream.txt'), 'streaming data');

    let received = '';
    const mockWritable = new Writable({
      write(chunk, encoding, callback) {
        received += chunk.toString();
        callback();
      }
    });

    await adapter.stream(fileMeta, mockWritable);

    // Wait slightly for streaming to complete
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(received).toBe('streaming data');
  });

  it('should return a readable stream via getReadable', async () => {
    const fileMeta: FileType = { bucket: 'test-bucket', ref: 'readable.txt', contentType: 'text/plain' };
    await fs.outputFile(path.join(tempDir, 'readable.txt'), 'readable data');

    const stream = await adapter.getReadable(fileMeta);
    let data = '';
    for await (const chunk of stream) {
      data += chunk.toString();
    }
    expect(data).toBe('readable data');
  });

  it('should retrieve metadata with correct file size', async () => {
    const fileMeta: FileType = { bucket: 'test-bucket', ref: 'meta.txt', contentType: 'text/plain' };
    const content = 'meta test content';
    await fs.outputFile(path.join(tempDir, 'meta.txt'), content);

    const result = await adapter.getMetaData(fileMeta);
    expect(result.size).toBe(content.length);
  });
});
