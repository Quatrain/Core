// packages/git-forgejo/src/ForgejoHttpClient.ts
/**
 * @quatrain/git-forgejo - ForgejoHttpClient
 * @description Lightweight HTTP-based Forgejo Git client for Web/WebView/Edge environments
 * @license AGPL-3.0-only
 */

import { AbstractGitHttpClient, FileTreeNode } from "@quatrain/git";

export interface ForgejoHttpClientConfig {
  token?: string;
  host?: string;
  owner: string;
  repo: string;
  branch?: string;
}

export class ForgejoHttpClient extends AbstractGitHttpClient {
  private token?: string;
  private host: string;
  private owner: string;
  private repo: string;
  private branch: string;
  private baseUrl: string;

  constructor(config: ForgejoHttpClientConfig) {
    super();
    this.token = config.token;
    this.host = config.host || "git.qtrn.io";
    this.owner = config.owner;
    this.repo = config.repo;
    this.branch = config.branch || "main";
    this.baseUrl = this.host.startsWith("http") ? this.host : `https://${this.host}`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "Quatrain-Forgejo-Client",
    };
    if (this.token) {
      headers["Authorization"] = `token ${this.token}`;
    }
    return headers;
  }

  /**
   * Fetches the repository file tree recursively via Forgejo REST API v1
   */
  async fetchFileTree(branch?: string): Promise<FileTreeNode[]> {
    const targetBranch = branch || this.branch;
    const url = `${this.baseUrl}/api/v1/repos/${this.owner}/${this.repo}/git/trees/${targetBranch}?recursive=1`;
    const res = await fetch(url, { headers: this.getHeaders() });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Forgejo API error ${res.status}: ${errBody}`);
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
   * Downloads a file's raw content by its blob SHA via Forgejo Git Database API
   */
  async downloadBlob(sha: string): Promise<string> {
    const url = `${this.baseUrl}/api/v1/repos/${this.owner}/${this.repo}/git/blobs/${sha}`;
    const res = await fetch(url, { headers: this.getHeaders() });

    if (!res.ok) {
      throw new Error(`Failed to download blob ${sha} from Forgejo: status ${res.status}`);
    }

    const data = (await res.json()) as any;
    if (data.content && data.encoding === "base64") {
      // Decode base64 in Web / Node / Bun universal way
      const binaryString = atob(data.content.replace(/\n/g, ""));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder("utf-8").decode(bytes);
    }

    // Direct text fallback
    return typeof data === "string" ? data : JSON.stringify(data);
  }
}
