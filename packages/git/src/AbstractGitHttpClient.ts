// packages/git/src/AbstractGitHttpClient.ts
/**
 * @quatrain/git - AbstractGitHttpClient
 * @license AGPL-3.0-only
 */

import type { GitHttpClientInterface } from "./GitHttpClientInterface";
import type { FileTreeNode, FrontmatterResult } from "./types";

export abstract class AbstractGitHttpClient implements GitHttpClientInterface {
  abstract fetchFileTree(branch?: string): Promise<FileTreeNode[]>;
  abstract downloadBlob(sha: string): Promise<string>;

  /**
   * Universal frontmatter parser compatible with OKF / Obsidian / Astro notes
   */
  public parseFrontmatter(content: string): FrontmatterResult {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
      return { metadata: {}, body: content };
    }

    const yamlSection = match[1];
    const body = match[2];
    const metadata: Record<string, any> = {};

    const lines = yamlSection.split("\n");
    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        let value: any = line.substring(colonIndex + 1).trim();

        if (value.startsWith("[") && value.endsWith("]")) {
          try {
            value = JSON.parse(value.replace(/'/g, '"'));
          } catch {
            value = value
              .substring(1, value.length - 1)
              .split(",")
              .map((s: string) => s.trim().replace(/^["']|["']$/g, ""));
          }
        } else {
          value = value.replace(/^["']|["']$/g, "");
        }
        metadata[key] = value;
      }
    }
    return { metadata, body };
  }
}
