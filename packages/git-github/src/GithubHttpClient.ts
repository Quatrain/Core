// packages/git-github/src/GithubHttpClient.ts
/**
 * @quatrain/git-github - GithubHttpClient
 * @description Lightweight HTTP-based GitHub Git client for Web/WebView/Edge environments
 * @license AGPL-3.0-only
 */

import { AbstractGitHttpClient, FileTreeNode } from "@quatrain/git";

export interface GithubHttpClientConfig {
  token?: string;
  host?: string;
  owner: string;
  repo: string;
  branch?: string;
}

export class GithubHttpClient extends AbstractGitHttpClient {
  private token?: string;
  private host: string;
  private owner: string;
  private repo: string;
  private branch: string;
  private baseUrl: string;

  constructor(config: GithubHttpClientConfig) {
    super();
    this.token = config.token;
    this.host = config.host || "github.com";
    this.owner = config.owner;
    this.repo = config.repo;
    this.branch = config.branch || "main";
    this.baseUrl = this.host === "github.com" ? "https://api.github.com" : `https://${this.host}/api/v3`;
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

  /**
   * Fetches the repository file tree recursively
   */
  async fetchFileTree(branch?: string): Promise<FileTreeNode[]> {
    const targetBranch = branch || this.branch;
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/git/trees/${targetBranch}?recursive=1`;
    const res = await fetch(url, { headers: this.getHeaders() });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${errBody}`);
    }

    const data = (await res.json()) as any;
    const tree = data.tree || [];
    return tree.map((item: any) => ({
      path: item.path,
      type: item.type === "blob" ? "blob" : item.type === "tree" ? "tree" : item.type,
      sha: item.sha,
      size: item.size,
    }));
  }

  /**
   * Downloads a file's raw content by its blob SHA
   */
  async downloadBlob(sha: string): Promise<string> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/git/blobs/${sha}`;
    const headers = {
      ...this.getHeaders(),
      Accept: "application/vnd.github.v3.raw",
    };
    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error(`Failed to download blob ${sha}: status ${res.status}`);
    }

    return res.text();
  }
}
