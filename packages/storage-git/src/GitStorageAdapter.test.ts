import { GitStorageAdapter } from './GitStorageAdapter';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'fs-extra';
import { Readable, Writable } from 'node:stream';
import { FileType } from '@quatrain/storage';
import { execSync } from 'node:child_process';

describe('GitStorageAdapter', () => {
  let tempDir: string;
  let adapter: GitStorageAdapter;

  beforeEach(async () => {
    // Create a unique temporary directory
    tempDir = path.join(os.tmpdir(), 'quatrain-storage-git-test', Math.random().toString(36).substring(7));
    await fs.ensureDir(tempDir);

    // Initialize as a git repository so local mode doesn't fail
    try {
      execSync('git init && git config user.name "Test Runner" && git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });
    } catch (e) {
      // Fallback if git is not installed or configured
    }

    const params = {
      config: { 
         mode: 'local',
         localPath: tempDir,
         branch: 'main',
         bucket: 'test-bucket'
      }
    };
    adapter = new GitStorageAdapter(params as any);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should return driver via getDriver', () => {
    expect(adapter.getDriver()).toBeDefined();
  });

  it('should create a file from stream', async () => {
    const fileMeta: FileType = { bucket: 'default', ref: 'doc.txt' };
    const content = 'hello git storage';
    const stream = Readable.from([content]);

    const result = await adapter.create(fileMeta, stream);
    expect(result.ref).toBe('doc.txt');

    const filePath = path.join(tempDir, 'doc.txt');
    expect(await fs.pathExists(filePath)).toBe(true);
    expect(await fs.readFile(filePath, 'utf8')).toBe(content);
  });

  it('should list files recursively matching prefix', async () => {
    await fs.outputFile(path.join(tempDir, 'docs/doc1.json'), '{"data":1}');
    await fs.outputFile(path.join(tempDir, 'docs/nested/doc2.json'), '{"data":2}');
    await fs.outputFile(path.join(tempDir, 'other/doc3.json'), '{"data":3}');

    const files = await adapter.list('docs');
    expect(files).toContain('docs/doc1.json');
    expect(files).toContain('docs/nested/doc2.json');
    expect(files).not.toContain('other/doc3.json');
  });

  it('should read file content via getReadable', async () => {
    const fileMeta: FileType = { bucket: 'default', ref: 'read-test.json' };
    await fs.outputFile(path.join(tempDir, 'read-test.json'), '{"hello":"world"}');

    const stream = await adapter.getReadable(fileMeta);
    let data = '';
    for await (const chunk of stream) {
      data += chunk.toString();
    }
    expect(data).toBe('{"hello":"world"}');
  });

  it('should delete file', async () => {
    const fileMeta: FileType = { bucket: 'default', ref: 'delete-test.json' };
    await fs.outputFile(path.join(tempDir, 'delete-test.json'), '{}');

    const success = await adapter.delete(fileMeta);
    expect(success).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, 'delete-test.json'))).toBe(false);
  });
});
