// packages/git/src/GitForgeAdapterInterface.ts
/**
 * @quatrain/git - GitForgeAdapterInterface
 * @description Hexagonal Port Interface for Git forge adapters (Forgejo, GitHub, GitLab, etc.)
 * @license AGPL-3.0-only
 */

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

export interface GitForgeAdapterInterface {
  readonly forgeType: ForgeType;
  readonly context: ForgeContext;

  // Diagnostic & Execution Mode
  isCliAvailable(): Promise<boolean>;
  getCliInstallHint(): string;
  getExecutionMode(): Promise<"cli" | "http">;

  // Authentication & Identity
  authStatus(): Promise<AuthStatus>;
  whoami(): Promise<string>;

  // Repository Operations
  repoView(): Promise<RepoDetails>;
  repoCreate(options: RepoCreateOptions): Promise<RepoDetails>;
  repoClone(target: string, destination?: string): Promise<void>;

  // Pull / Merge Request Operations
  prList(options?: PrListOptions): Promise<PullRequest[]>;
  prView(prNumber: number): Promise<PullRequest>;
  prCreate(options: PrCreateOptions): Promise<PullRequest>;
  prCheckout(prNumber: number): Promise<void>;
  prMerge(prNumber: number, options?: PrMergeOptions): Promise<void>;

  // Release Operations
  releaseCreate(options: ReleaseCreateOptions): Promise<void>;

  // Git Plumbing & File Operations (Core Code & Modaka sync)
  fetchFileTree(branch?: string): Promise<FileTreeNode[]>;
  downloadBlob(sha: string): Promise<string>;
  pull(branch?: string): Promise<void>;
  push(files: CommitFile[], message: string, branch?: string): Promise<void>;
  createBranch(branchName: string, fromBranch?: string): Promise<void>;

  // Passthrough escape hatch for native CLI power users
  passthrough(args: string[]): Promise<number>;
}
