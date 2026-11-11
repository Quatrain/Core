// packages/git/src/AbstractGitForgeAdapter.ts
/**
 * @quatrain/git - AbstractGitForgeAdapter
 * @description Bi-modal base class providing safe CLI execution and HTTP fallback
 * @license AGPL-3.0-only
 */

declare const Bun: any;

import type { GitForgeAdapterInterface } from "./GitForgeAdapterInterface";
import type {
  AuthStatus,
  CommitFile,
  FileTreeNode,
  ForgeContext,
  ForgeType,
  PrCreateOptions,
  PrListOptions,
  PrMergeOptions,
  PullRequest,
  ReleaseCreateOptions,
  RepoCreateOptions,
  RepoDetails,
} from "./types";

export abstract class AbstractGitForgeAdapter implements GitForgeAdapterInterface {
  abstract readonly forgeType: ForgeType;

  constructor(public readonly context: ForgeContext) {}

  abstract isCliAvailable(): Promise<boolean>;
  abstract getCliInstallHint(): string;

  /**
   * Dynamically resolves execution mode: 'cli' if CLI tool exists and is accessible, otherwise 'http'
   */
  public async getExecutionMode(): Promise<"cli" | "http"> {
    return (await this.isCliAvailable()) ? "cli" : "http";
  }

  abstract authStatus(): Promise<AuthStatus>;
  abstract whoami(): Promise<string>;

  abstract repoView(): Promise<RepoDetails>;
  abstract repoCreate(options: RepoCreateOptions): Promise<RepoDetails>;
  abstract repoClone(target: string, destination?: string): Promise<void>;

  abstract prList(options?: PrListOptions): Promise<PullRequest[]>;
  abstract prView(prNumber: number): Promise<PullRequest>;
  abstract prCreate(options: PrCreateOptions): Promise<PullRequest>;
  abstract prCheckout(prNumber: number): Promise<void>;
  abstract prMerge(prNumber: number, options?: PrMergeOptions): Promise<void>;

  abstract releaseCreate(options: ReleaseCreateOptions): Promise<void>;

  abstract fetchFileTree(branch?: string): Promise<FileTreeNode[]>;
  abstract downloadBlob(sha: string): Promise<string>;
  abstract pull(branch?: string): Promise<void>;
  abstract push(files: CommitFile[], message: string, branch?: string): Promise<void>;
  abstract createBranch(branchName: string, fromBranch?: string): Promise<void>;

  abstract passthrough(args: string[]): Promise<number>;

  /**
   * Cybersecurity: Safe process execution without shell interpolation (prevents shell injection)
   */
  protected async spawnSafe(
    binary: string,
    args: string[],
    env?: Record<string, string>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (typeof Bun !== "undefined") {
      const proc = Bun.spawn([binary, ...args], {
        env: { ...process.env, ...env },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
    }

    // Node.js fallback
    const { spawn } = await import("node:child_process");
    return new Promise((resolve, reject) => {
      const child = spawn(binary, args, {
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d) => (stdout += d.toString()));
      child.stderr?.on("data", (d) => (stderr += d.toString()));
      child.on("close", (exitCode) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: exitCode ?? 0 });
      });
      child.on("error", reject);
    });
  }

  /**
   * Cybersecurity: Redact sensitive tokens from URLs and log messages
   */
  public redact(text: string): string {
    return text
      .replace(/(token|ghp_|glpat-|bb_app_)[a-zA-Z0-9_\-=]+/gi, "[REDACTED_SECRET]")
      .replace(/:\/\/[^:]+:[^@]+@/g, "://[REDACTED_CREDS]@");
  }
}
