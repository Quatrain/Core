// packages/git/src/GitHttpClientInterface.ts
/**
 * @quatrain/git - GitHttpClientInterface
 * @description Contract for lightweight, HTTP-based git clients (Web, WebView, Workers)
 * @license AGPL-3.0-only
 */

import type { FileTreeNode, FrontmatterResult } from "./types";

export interface GitHttpClientInterface {
  /**
   * Fetches the repository file tree recursively
   */
  fetchFileTree(branch?: string): Promise<FileTreeNode[]>;

  /**
   * Downloads a file's raw content by its blob SHA
   */
  downloadBlob(sha: string): Promise<string>;

  /**
   * Parses a Markdown document containing a YAML frontmatter block
   */
  parseFrontmatter(content: string): FrontmatterResult;
}
