import { Command } from './Command';
import path from 'node:path';

describe('Command', () => {
  test('should construct and return static instance', () => {
    const cmd = Command.create('node');
    expect(cmd).toBeInstanceOf(Command);
  });

  test('should execute system echo command and retrieve stdout', async () => {
    const cmd = Command.create('echo')
      .arg('hello world');

    const result = await cmd.execute();
    expect(result.success).toBe(true);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('hello world');
  });

  test('should pass environment variables correctly', async () => {
    // Run a node script that prints the environment variable
    const cmd = Command.create('node')
      .args(['-e', 'console.log(process.env.TEST_VAR)'])
      .env({ TEST_VAR: 'quatrain-cli' });

    const result = await cmd.execute();
    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('quatrain-cli');
  });

  test('should execute within specified working directory', async () => {
    const targetDir = path.resolve(__dirname);
    const cmd = Command.create('node')
      .args(['-e', 'console.log(process.cwd())'])
      .cwd(targetDir);

    const result = await cmd.execute();
    expect(result.success).toBe(true);
    // CWD returned from subprocess should match our targetDir
    // Note: On Mac, /var/folders can resolve to /private/var/folders, so we resolve both paths
    const resolvedPath = fsResolve(result.stdout.trim());
    const expectedPath = fsResolve(targetDir);
    expect(resolvedPath).toBe(expectedPath);
  });

  test('should report process failure on bad commands', async () => {
    const cmd = Command.create('node')
      .args(['-e', 'process.exit(5)']);

    const result = await cmd.execute();
    expect(result.success).toBe(false);
    expect(result.code).toBe(5);
  });
});

function fsResolve(p: string): string {
  try {
    return path.resolve(p);
  } catch {
    return p;
  }
}
