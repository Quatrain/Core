// packages/git/src/types.ts
/**
 * @quatrain/git - Domain Types & Interfaces
 * @license AGPL-3.0-only
 */

export type ForgeType = "forgejo" | "github" | "gitlab" | "bitbucket" | "custom";

export interface ForgeContext {
  forgeType: ForgeType;
  host: string;
  owner: string;
  repo: string;
  branch?: string;
  token?: string;
  remoteName?: string;
  remoteUrl?: string;
}

export interface CommitFile {
  path: string;
  content: string;
}

export interface FileTreeNode {
  path: string;
  type: "blob" | "tree" | "commit" | string;
  sha: string;
  size?: number;
}

export interface FrontmatterResult {
  metadata: Record<string, any>;
  body: string;
}

export interface PullRequest {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  author: string;
  sourceBranch: string;
  targetBranch: string;
  url: string;
  updatedAt?: string;
}

export interface RepoDetails {
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  isPrivate: boolean;
  cloneUrl: string;
  sshUrl: string;
  webUrl: string;
  description?: string;
}

export interface AuthStatus {
  loggedIn: boolean;
  user?: string;
  host: string;
  tokenType?: string;
  scopes?: string[];
  error?: string;
}

export interface PrListOptions {
  state?: "open" | "closed" | "all";
  limit?: number;
}

export interface PrCreateOptions {
  title: string;
  body?: string;
  head?: string;
  base?: string;
}

export interface PrMergeOptions {
  method?: "merge" | "rebase" | "squash";
  deleteBranch?: boolean;
}

export interface RepoCreateOptions {
  name: string;
  isPrivate?: boolean;
  description?: string;
  org?: string;
}

export interface ReleaseCreateOptions {
  tag: string;
  title?: string;
  notes?: string;
  draft?: boolean;
  prerelease?: boolean;
}
