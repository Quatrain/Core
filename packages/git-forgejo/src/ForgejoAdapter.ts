// packages/git-forgejo/src/ForgejoAdapter.ts
/**
 * @quatrain/git-forgejo - ForgejoAdapter
 * @description Sovereign Bi-modal Forgejo & Gitea adapter (tea CLI <-> REST API v1)
 * @license AGPL-3.0-only
 */

import {
  AbstractGitForgeAdapter,
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
} from "@quatrain/git";
import { ForgejoHttpClient } from "./ForgejoHttpClient";

export class ForgejoAdapter extends AbstractGitForgeAdapter {
  public readonly forgeType: ForgeType = "forgejo";
  private readonly baseUrl: string;
  private token?: string;
  private httpClient: ForgejoHttpClient;

  constructor(context: ForgeContext) {
    super(context);
    const host = context.host || "git.qtrn.io";
    this.baseUrl = host.startsWith("http") ? host : `https://${host}`;
    this.token =
      context.token ||
      process.env.FORGEJO_TOKEN ||
      process.env.QTRN_GIT_TOKEN ||
      process.env.TEA_TOKEN ||
      "ae327dcdf0980469f32610e9a736659de1b71fe0"; // sovereign default token

    this.httpClient = new ForgejoHttpClient({
      host: context.host,
      token: this.token,
      owner: context.owner,
      repo: context.repo,
      branch: context.branch || "main",
    });
  }

  public async isCliAvailable(): Promise<boolean> {
    try {
      const res = await this.spawnSafe("which", ["tea"]);
      return res.exitCode === 0 && res.stdout.length > 0;
    } catch {
      return false;
    }
  }

  public getCliInstallHint(): string {
    return "Forgejo/Gitea CLI (tea) recommended: brew install tea (macOS)";
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `token ${this.token}`;
    }
    return headers;
  }

  // --- Authentication ---
  public async authStatus(): Promise<AuthStatus> {
    // 1. Try CLI if available
    if (await this.isCliAvailable()) {
      try {
        const res = await this.spawnSafe("tea", ["whoami"]);
        if (res.exitCode === 0 && res.stdout) {
          return {
            loggedIn: true,
            user: res.stdout.split("\n")[0].trim(),
            host: this.context.host || "git.qtrn.io",
            tokenType: "tea-cli",
          };
        }
      } catch {
        // Fallback to HTTP
      }
    }

    // 2. HTTP Fallback
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/user`, { headers: this.getHeaders() });
      if (res.ok) {
        const user = (await res.json()) as any;
        return {
          loggedIn: true,
          user: user.username,
          host: this.context.host || "git.qtrn.io",
          tokenType: "Bearer/Token",
        };
      }
      return {
        loggedIn: false,
        host: this.context.host || "git.qtrn.io",
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (e: any) {
      return { loggedIn: false, host: this.context.host || "git.qtrn.io", error: e.message };
    }
  }

  public async whoami(): Promise<string> {
    const status = await this.authStatus();
    return status.user || "unauthenticated";
  }

  // --- Repositories ---
  public async repoView(): Promise<RepoDetails> {
    const owner = this.context.owner || "qtrn-io";
    const repo = this.context.repo || "cluster";
    const res = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch repo ${owner}/${repo}: HTTP ${res.status}`);
    }
    const data = (await res.json()) as any;
    return {
      name: data.name,
      fullName: data.full_name,
      owner: data.owner?.login || owner,
      defaultBranch: data.default_branch || "main",
      isPrivate: data.private,
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
      webUrl: data.html_url,
      description: data.description,
    };
  }

  public async repoCreate(options: RepoCreateOptions): Promise<RepoDetails> {
    const endpoint = options.org
      ? `${this.baseUrl}/api/v1/orgs/${options.org}/repos`
      : `${this.baseUrl}/api/v1/user/repos`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        name: options.name,
        private: options.isPrivate !== false,
        description: options.description || "",
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create repository ${options.name}: HTTP ${res.status}`);
    }
    const data = (await res.json()) as any;
    return {
      name: data.name,
      fullName: data.full_name,
      owner: data.owner?.login || "",
      defaultBranch: data.default_branch || "main",
      isPrivate: data.private,
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
      webUrl: data.html_url,
      description: data.description,
    };
  }

  public async repoClone(target: string, destination?: string): Promise<void> {
    const url = target.startsWith("http") || target.startsWith("git@")
      ? target
      : `${this.baseUrl}/${target}.git`;

    const args = ["clone", url];
    if (destination) args.push(destination);
    const res = await this.spawnSafe("git", args);
    if (res.exitCode !== 0) {
      throw new Error(`git clone failed: ${res.stderr}`);
    }
  }

  // --- Pull Requests ---
  public async prList(options?: PrListOptions): Promise<PullRequest[]> {
    const owner = this.context.owner || "qtrn-io";
    const repo = this.context.repo || "cluster";
    const state = options?.state || "open";
    const limit = options?.limit || 20;

    const url = `${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls?state=${state}&limit=${limit}`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to list PRs: HTTP ${res.status}`);
    }
    const list = (await res.json()) as any[];
    return list.map((item: any) => ({
      number: item.number,
      title: item.title,
      state: item.merged ? "merged" : item.state === "closed" ? "closed" : "open",
      author: item.user?.username || "unknown",
      sourceBranch: item.head?.ref,
      targetBranch: item.base?.ref,
      url: item.html_url,
      updatedAt: item.updated_at,
    }));
  }

  public async prView(prNumber: number): Promise<PullRequest> {
    const owner = this.context.owner || "qtrn-io";
    const repo = this.context.repo || "cluster";
    const res = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls/${prNumber}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch PR #${prNumber}: HTTP ${res.status}`);
    }
    const item = (await res.json()) as any;
    return {
      number: item.number,
      title: item.title,
      state: item.merged ? "merged" : item.state === "closed" ? "closed" : "open",
      author: item.user?.username || "unknown",
      sourceBranch: item.head?.ref,
      targetBranch: item.base?.ref,
      url: item.html_url,
    };
  }

  public async prCreate(options: PrCreateOptions): Promise<PullRequest> {
    // 1. Try CLI if available
    if (await this.isCliAvailable()) {
      const cliArgs = ["pr", "create", "--title", options.title];
      if (options.body) cliArgs.push("--description", options.body);
      if (options.base) cliArgs.push("--base", options.base);
      if (options.head) cliArgs.push("--head", options.head);
      const res = await this.spawnSafe("tea", cliArgs);
      if (res.exitCode === 0) {
        const list = await this.prList({ limit: 1 });
        return list[0];
      }
    }

    // 2. HTTP Fallback
    const owner = this.context.owner || "qtrn-io";
    const repo = this.context.repo || "cluster";
    let head = options.head;
    if (!head) {
      const branchRes = await this.spawnSafe("git", ["branch", "--show-current"]);
      head = branchRes.stdout || "main";
    }

    const res = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        title: options.title,
        body: options.body || "",
        base: options.base || "main",
        head,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create PR: HTTP ${res.status} - ${await res.text()}`);
    }
    const item = (await res.json()) as any;
    return {
      number: item.number,
      title: item.title,
      state: "open",
      author: item.user?.username || "unknown",
      sourceBranch: item.head?.ref,
      targetBranch: item.base?.ref,
      url: item.html_url,
    };
  }

  public async prCheckout(prNumber: number): Promise<void> {
    if (await this.isCliAvailable()) {
      const res = await this.spawnSafe("tea", ["pr", "checkout", prNumber.toString()]);
      if (res.exitCode === 0) return;
    }
    // Git plumbing fallback
    await this.spawnSafe("git", ["fetch", "origin", `pull/${prNumber}/head:pr-${prNumber}`]);
    await this.spawnSafe("git", ["checkout", `pr-${prNumber}`]);
  }

  public async prMerge(prNumber: number, options?: PrMergeOptions): Promise<void> {
    const owner = this.context.owner || "qtrn-io";
    const repo = this.context.repo || "cluster";
    const doType = options?.method === "squash" ? "squash" : options?.method === "rebase" ? "rebase" : "merge";

    const res = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        Do: doType,
        delete_branch_after_merge: options?.deleteBranch ?? true,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to merge PR #${prNumber}: HTTP ${res.status}`);
    }
  }

  // --- Releases ---
  public async releaseCreate(options: ReleaseCreateOptions): Promise<void> {
    const owner = this.context.owner || "qtrn-io";
    const repo = this.context.repo || "cluster";

    const res = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/releases`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        tag_name: options.tag,
        name: options.title || options.tag,
        body: options.notes || "",
        draft: !!options.draft,
        prerelease: !!options.prerelease,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create release ${options.tag}: HTTP ${res.status}`);
    }
  }

  // --- File Sync & Modaka Support ---
  public async fetchFileTree(branch?: string): Promise<FileTreeNode[]> {
    return this.httpClient.fetchFileTree(branch);
  }

  public async downloadBlob(sha: string): Promise<string> {
    return this.httpClient.downloadBlob(sha);
  }

  // --- Core Code Repository Adapter Compatibility ---
  public async pull(branch: string = "main"): Promise<void> {
    const owner = this.context.owner;
    const repo = this.context.repo;
    const res = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/branches/${branch}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to pull branch ${branch}: HTTP ${res.status}`);
    }
  }

  public async push(files: CommitFile[], message: string, branch: string = "main"): Promise<void> {
    const owner = this.context.owner;
    const repo = this.context.repo;

    // Use Forgejo commit changes API
    const res = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/contents`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        branch,
        message,
        files: files.map((f) => ({
          path: f.path,
          content: Buffer.from(f.content).toString("base64"),
          operation: "create",
        })),
      }),
    });

    if (!res.ok) {
      // Fallback: update individual files or git push
      for (const file of files) {
        await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/contents/${file.path}`, {
          method: "PUT",
          headers: this.getHeaders(),
          body: JSON.stringify({
            branch,
            message,
            content: Buffer.from(file.content).toString("base64"),
          }),
        });
      }
    }
  }

  public async createBranch(branchName: string, fromBranch: string = "main"): Promise<void> {
    const owner = this.context.owner;
    const repo = this.context.repo;
    const res = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/branches`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        new_branch_name: branchName,
        old_branch_name: fromBranch,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create branch ${branchName}: HTTP ${res.status}`);
    }
  }

  public async passthrough(args: string[]): Promise<number> {
    if (await this.isCliAvailable()) {
      const res = await this.spawnSafe("tea", args);
      return res.exitCode;
    }
    console.error(`[ForgejoAdapter] ${this.getCliInstallHint()}`);
    return 1;
  }
}
