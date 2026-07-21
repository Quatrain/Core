/**
 * A lightweight, HTTP-based GitHub Git client that runs in standard Web / WebView
 * environments without requiring native git binary dependencies or Node.js process execution.
 */
export class GithubHttpClient {
   private token: string;
   private owner: string;
   private repo: string;
   private branch: string;

   constructor(config: { token: string; owner: string; repo: string; branch?: string }) {
      this.token = config.token;
      this.owner = config.owner;
      this.repo = config.repo;
      this.branch = config.branch || 'main';
   }

   /**
    * Fetches the repository file tree recursively.
    */
   async fetchFileTree(): Promise<Array<{ path: string; type: string; sha: string }>> {
      const url = `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${this.branch}?recursive=1`;
      const res = await fetch(url, {
         headers: {
            'Authorization': `token ${this.token}`,
            'User-Agent': 'Quatrain-Git-Client'
         }
      });

      if (!res.ok) {
         const errBody = await res.text();
         throw new Error(`GitHub API error ${res.status}: ${errBody}`);
      }

      const data = await res.json() as any;
      return data.tree || [];
   }

   /**
    * Downloads a file's raw content by its blob SHA.
    */
   async downloadBlob(sha: string): Promise<string> {
      const url = `https://api.github.com/repos/${this.owner}/${this.repo}/git/blobs/${sha}`;
      const res = await fetch(url, {
         headers: {
            'Authorization': `token ${this.token}`,
            'User-Agent': 'Quatrain-Git-Client',
            'Accept': 'application/vnd.github.v3.raw'
         }
      });

      if (!res.ok) {
         throw new Error(`Failed to download blob ${sha}: status ${res.status}`);
      }

      return res.text();
   }

   /**
    * Parses a Markdown note containing a YAML frontmatter block.
    */
   parseFrontmatter(content: string): { metadata: Record<string, any>; body: string } {
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (!match) {
         return { metadata: {}, body: content };
      }

      const yamlSection = match[1];
      const body = match[2];
      const metadata: Record<string, any> = {};

      const lines = yamlSection.split('\n');
      for (const line of lines) {
         const colonIndex = line.indexOf(':');
         if (colonIndex !== -1) {
            const key = line.substring(0, colonIndex).trim();
            let value: any = line.substring(colonIndex + 1).trim();

            if (value.startsWith('[') && value.endsWith(']')) {
               try {
                  value = JSON.parse(value.replace(/'/g, '"'));
               } catch (e) {
                  value = value.substring(1, value.length - 1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, ''));
               }
            } else {
               value = value.replace(/^["']|["']$/g, '');
            }
            metadata[key] = value;
         }
      }
      return { metadata, body };
   }
}
