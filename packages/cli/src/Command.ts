import { spawn } from 'node:child_process';

/**
 * Fluent builder for launching and managing system subprocesses.
 * Supports cross-platform execution and shell redirection (e.g. PowerShell).
 */
export class Command {
  private bin: string;
  private argsList: string[] = [];
  private workingDir?: string;
  private envVars: Record<string, string> = {};
  private stdoutBehavior: 'pipe' | 'inherit' | 'ignore' = 'pipe';
  private stderrBehavior: 'pipe' | 'inherit' | 'ignore' = 'pipe';
  private useShell = false;
  private shellType?: 'powershell' | 'pwsh';

  /**
   * Instantiate a new Command.
   * @param bin Name or path of the binary/command.
   */
  constructor(bin: string) {
    this.bin = bin;
  }

  /**
   * Static factory to instantiate a new Command.
   * @param bin Name or path of the binary/command.
   */
  static create(bin: string): Command {
    return new Command(bin);
  }

  /**
   * Add a single command-line argument.
   * @param value Argument string.
   */
  arg(value: string): this {
    this.argsList.push(value);
    return this;
  }

  /**
   * Add multiple command-line arguments.
   * @param values List of argument strings.
   */
  args(values: string[]): this {
    this.argsList.push(...values);
    return this;
  }

  /**
   * Set the working directory for the subprocess.
   * @param dir Absolute or relative directory path.
   */
  cwd(dir: string): this {
    this.workingDir = dir;
    return this;
  }

  /**
   * Set or extend environment variables for the subprocess.
   * @param vars Key-value dictionary of environment variables.
   */
  env(vars: Record<string, string>): this {
    Object.assign(this.envVars, vars);
    return this;
  }

  /**
   * Configure the subprocess to inherit stdout and stderr from the parent process.
   */
  inherit(): this {
    this.stdoutBehavior = 'inherit';
    this.stderrBehavior = 'inherit';
    return this;
  }

  /**
   * Enable executing the command via PowerShell (powershell.exe or pwsh).
   * @param use Whether to use PowerShell.
   * @param type Shell binary choice ('powershell' or 'pwsh').
   */
  usePowerShell(use = true, type: 'powershell' | 'pwsh' = 'powershell'): this {
    this.useShell = use;
    this.shellType = type;
    return this;
  }

  /**
   * Execute the configured command and return a Promise resolving on process exit.
   * @returns Promise resolving with standard output, error streams, and status.
   */
  async execute(): Promise<{ stdout: string; stderr: string; code: number | null; success: boolean }> {
    return new Promise((resolve, reject) => {
      let spawnBin = this.bin;
      let spawnArgs = [...this.argsList];

      const isWin = process.platform === 'win32';

      // Route execution via PowerShell if configured or if on Windows with shellType set
      if (this.useShell || (isWin && this.shellType)) {
        const shell = this.shellType || (isWin ? 'powershell.exe' : 'pwsh');
        
        // Assemble argument list safely escaping quotes for PowerShell Command parsing
        const cmdString = [this.bin, ...this.argsList]
          .map((arg) => {
            if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
              return `"${arg.replace(/"/g, '`"')}"`;
            }
            return arg;
          })
          .join(' ');

        spawnBin = shell;
        spawnArgs = ['-NoProfile', '-NonInteractive', '-Command', cmdString];
      }

      const child = spawn(spawnBin, spawnArgs, {
        cwd: this.workingDir,
        env: { ...process.env, ...this.envVars },
        stdio: ['inherit', this.stdoutBehavior, this.stderrBehavior],
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          code,
          success: code === 0,
        });
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }
}
