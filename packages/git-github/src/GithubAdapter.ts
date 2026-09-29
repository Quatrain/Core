// packages/git-github/src/GithubAdapter.ts
/**
 * @quatrain/git-github - GithubAdapter
 * @description Bi-modal GitHub adapter (gh CLI <-> GitHub REST API)
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
import { GithubHttpClient } from "./GithubHttpClient";

export class GithubAdapter extends AbstractGitForgeAdapter {
  public readonly forgeType: ForgeType = "github";
  private readonly baseUrl: string;
  private token?: string;
  private httpClient: GithubHttpClient;

  constructor(context: ForgeContext) {
    super(context);
    const host = context.host || "github.com";
    this.baseUrl = host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`;
    this.token = context.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

    this.httpClient = new GithubHttpClient({
      host: context.host,
      token: this.token,
      owner: context.owner,
      repo: context.repo,
      branch: context.branch || "main",
    });
  }

  public async isCliAvailable(): Promise<boolean> {
    try {
      const res = await this.spawnSafe("which", ["gh"]);
      return res.exitCode === 0 && res.stdout.length > 0;
    } catch {
      return false;
    }
  }

  public getCliInstallHint(): string {
    return "GitHub CLI (gh) recommended: brew install gh (macOS) or sudo apt install gh (Linux)";
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Quatrain-Git-Client",
    };
    if (this.token) {
      headers["Authorization"] = `token ${this.token}`;
    }
    return headers;
  }

  // --- Authentication ---
  public async authStatus(): Promise<AuthStatus> {
    if (await this.isCliAvailable()) {
      try {
        const res = await this.spawnSafe("gh", ["auth", "status"]);
        const full = res.stdout + res.stderr;
        const loggedIn = res.exitCode === 0 || full.includes("Logged in to");
        const userMatch = full.match(/account ([^ \n(]+)/);
        if (loggedIn) {
          return {
            loggedIn: true,
            user: userMatch ? userMatch[1] : undefined,
            host: this.context.host || "github.com",
            tokenType: "gh-cli",
          };
        }
      } catch {
        // Fallback
      }
    }

    // HTTP Fallback
    try {
      const res = await fetch(`${this.baseUrl}/user`, { headers: this.getHeaders() });
      if (res.ok) {
        const user = (await res.json()) as any;
        return {
          loggedIn: true,
          user: user.login,
          host: this.context.host || "github.com",
          tokenType: "Bearer/Token",
        };
      }
      return {
        loggedIn: false,
        host: this.context.host || "github.com",
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (e: any) {
      return { loggedIn: false, host: this.context.host || "github.com", error: e.message };
    }
  }

  public async whoami(): Promise<string> {
    const status = await this.authStatus();
    return status.user || "unauthenticated";
  }

  // --- Repositories ---
  public async repoView(): Promise<RepoDetails> {
    if (await this.isCliAvailable()) {
      const res = await this.spawnSafe("gh", [
        "repo",
        "view",
        "--json",
        "name,nameWithOwner,owner,defaultBranchRef,isPrivate,url,sshUrl",
      ]);
      if (res.exitCode === 0 && res.stdout) {
        const data = JSON.parse(res.stdout);
        return {
          name: data.name,
          fullName: data.nameWithOwner,
          owner: data.owner?.login || this.context.owner,
          defaultBranch: data.defaultBranchRef?.name || "main",
          isPrivate: data.isPrivate,
          cloneUrl: data.url + ".git",
          sshUrl: data.sshUrl,
          webUrl: data.url,
        };
      }
    }

    // HTTP Fallback
    const owner = this.context.owner;
    const repo = this.context.repo;
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, { headers: this.getHeaders() });
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
    if (await this.isCliAvailable()) {
      const args = ["repo", "create", options.name, options.isPrivate ? "--private" : "--public"];
      if (options.description) args.push("--description", options.description);
      const res = await this.spawnSafe("gh", args);
      if (res.exitCode === 0) return this.repoView();
    }

    // HTTP Fallback
    const endpoint = options.org ? `${this.baseUrl}/orgs/${options.org}/repos` : `${this.baseUrl}/user/repos`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        name: options.name,
        private: options.isPrivate !== false,
        description: options.description || "",
      }),
    });
    if (!res.ok) throw new Error(`Failed to create repository: HTTP ${res.status}`);
    return this.repoView();
  }

  public async repoClone(target: string, destination?: string): Promise<void> {
    const args = ["clone", target.startsWith("http") ? target : `https://github.com/${target}.git`];
    if (destination) args.push(destination);
    const res = await this.spawnSafe("git", args);
    if (res.exitCode !== 0) throw new Error(`git clone failed: ${res.stderr}`);
  }

  // --- Pull Requests ---
  public async prList(options?: PrListOptions): Promise<PullRequest[]> {
    if (await this.isCliAvailable()) {
      const args = ["pr", "list", "--json", "number,title,state,author,headRefName,baseRefName,url,updatedAt"];
      if (options?.state) args.push("--state", options.state);
      if (options?.limit) args.push("--limit", options.limit.toString());
      const res = await this.spawnSafe("gh", args);
      if (res.exitCode === 0 && res.stdout) {
        const list = JSON.parse(res.stdout);
        return list.map((item: any) => ({
          number: item.number,
          title: item.title,
          state: item.state?.toLowerCase() === "merged" ? "merged" : item.state?.toLowerCase() === "closed" ? "closed" : "open",
          author: item.author?.login || "unknown",
          sourceBranch: item.headRefName,
          targetBranch: item.baseRefName,
          url: item.url,
          updatedAt: item.updatedAt,
        }));
      }
    }

    // HTTP Fallback
    const owner = this.context.owner;
    const repo = this.context.repo;
    const state = options?.state || "open";
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls?state=${state}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list PRs: HTTP ${res.status}`);
    const list = (await res.json()) as any[];
    return list.map((item: any) => ({
      number: item.number,
      title: item.title,
      state: item.merged_at ? "merged" : item.state === "closed" ? "closed" : "open",
      author: item.user?.login || "unknown",
      sourceBranch: item.head?.ref,
      targetBranch: item.base?.ref,
      url: item.html_url,
      updatedAt: item.updated_at,
    }));
  }

  public async prView(prNumber: number): Promise<PullRequest> {
    if (await this.isCliAvailable()) {
      const res = await this.spawnSafe("gh", [
        "pr",
        "view",
        prNumber.toString(),
        "--json",
        "number,title,state,author,headRefName,baseRefName,url",
      ]);
      if (res.exitCode === 0 && res.stdout) {
        const item = JSON.parse(res.stdout);
        return {
          number: item.number,
          title: item.title,
          state: item.state?.toLowerCase() === "merged" ? "merged" : item.state?.toLowerCase() === "closed" ? "closed" : "open",
          author: item.author?.login || "unknown",
          sourceBranch: item.headRefName,
          targetBranch: item.baseRefName,
          url: item.url,
        };
      }
    }

    // HTTP Fallback
    const owner = this.context.owner;
    const repo = this.context.repo;
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch PR #${prNumber}: HTTP ${res.status}`);
    const item = (await res.json()) as any;
    return {
      number: item.number,
      title: item.title,
      state: item.merged_at ? "merged" : item.state === "closed" ? "closed" : "open",
      author: item.user?.login || "unknown",
      sourceBranch: item.head?.ref,
      targetBranch: item.base?.ref,
      url: item.html_url,
    };
  }

  public async prCreate(options: PrCreateOptions): Promise<PullRequest> {
    if (await this.isCliAvailable()) {
      const args = ["pr", "create", "--title", options.title];
      if (options.body) args.push("--body", options.body);
      if (options.base) args.push("--base", options.base);
      if (options.head) args.push("--head", options.head);
      const res = await this.spawnSafe("gh", args);
      if (res.exitCode === 0) {
        const list = await this.prList({ limit: 1 });
        return list[0];
      }
    }

    // HTTP Fallback
    const owner = this.context.owner;
    const repo = this.context.repo;
    let head = options.head;
    if (!head) {
      const branchRes = await this.spawnSafe("git", ["branch", "--show-current"]);
      head = branchRes.stdout || "main";
    }

    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        title: options.title,
        body: options.body || "",
        base: options.base || "main",
        head,
      }),
    });
    if (!res.ok) throw new Error(`Failed to create PR: HTTP ${res.status} - ${await res.text()}`);
    const item = (await res.json()) as any;
    return {
      number: item.number,
      title: item.title,
      state: "open",
      author: item.user?.login || "unknown",
      sourceBranch: item.head?.ref,
      targetBranch: item.base?.ref,
      url: item.html_url,
    };
  }

  public async prCheckout(prNumber: number): Promise<void> {
    if (await this.isCliAvailable()) {
      const res = await this.spawnSafe("gh", ["pr", "checkout", prNumber.toString()]);
      if (res.exitCode === 0) return;
    }
    await this.spawnSafe("git", ["fetch", "origin", `pull/${prNumber}/head:pr-${prNumber}`]);
    await this.spawnSafe("git", ["checkout", `pr-${prNumber}`]);
  }

  public async prMerge(prNumber: number, options?: PrMergeOptions): Promise<void> {
    if (await this.isCliAvailable()) {
      const args = ["pr", "merge", prNumber.toString()];
      if (options?.method === "squash") args.push("--squash");
      else if (options?.method === "rebase") args.push("--rebase");
      else args.push("--merge");
      if (options?.deleteBranch) args.push("--delete-branch");
      const res = await this.spawnSafe("gh", args);
      if (res.exitCode === 0) return;
    }

    const owner = this.context.owner;
    const repo = this.context.repo;
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify({
        merge_method: options?.method || "merge",
      }),
    });
    if (!res.ok) throw new Error(`Failed to merge PR #${prNumber}: HTTP ${res.status}`);
  }

  // --- Releases ---
  public async releaseCreate(options: ReleaseCreateOptions): Promise<void> {
    if (await this.isCliAvailable()) {
      const args = ["release", "create", options.tag];
      if (options.title) args.push("--title", options.title);
      if (options.notes) args.push("--notes", options.notes);
      if (options.draft) args.push("--draft");
      if (options.prerelease) args.push("--prerelease");
      const res = await this.spawnSafe("gh", args);
      if (res.exitCode === 0) return;
    }

    const owner = this.context.owner;
    const repo = this.context.repo;
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/releases`, {
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
    if (!res.ok) throw new Error(`Failed to create release: HTTP ${res.status}`);
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
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/branches/${branch}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to pull branch ${branch}: HTTP ${res.status}`);
  }

  public async push(files: CommitFile[], message: string, branch: string = "main"): Promise<void> {
    const owner = this.context.owner;
    const repo = this.context.repo;

    // Direct tree / commit API via HTTP
    for (const file of files) {
      await fetch(`${this.baseUrl}/repos/${owner}/${repo}/contents/${file.path}`, {
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

  public async createBranch(branchName: string, fromBranch: string = "main"): Promise<void> {
    const owner = this.context.owner;
    const repo = this.context.repo;

    const refRes = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`, {
      headers: this.getHeaders(),
    });
    if (!refRes.ok) throw new Error(`Failed to get ref for ${fromBranch}`);
    const refData = (await refRes.json()) as any;

    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: refData.object.sha,
      }),
    });
    if (!res.ok) throw new Error(`Failed to create branch ${branchName}: HTTP ${res.status}`);
  }

  public async passthrough(args: string[]): Promise<number> {
    if (await this.isCliAvailable()) {
      const res = await this.spawnSafe("gh", args);
      return res.exitCode;
    }
    console.error(`[GithubAdapter] ${this.getCliInstallHint()}`);
    return 1;
  }
}
