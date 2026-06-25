import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Core } from '@quatrain/core'

export class Skills extends Core {
   static logger = this.addLogger('Skills')

   /**
    * Safely writes JSON results to a file, automatically creating
    * parent subfolders (such as `.log/`) if they do not exist.
    * 
    * @param data - The data payload to serialize.
    * @param filePath - The destination file path.
    */
   static async writeOutput(data: any, filePath: string): Promise<void> {
      try {
         const parentDir = dirname(filePath)
         if (parentDir && parentDir !== '.') {
            await mkdir(parentDir, { recursive: true })
         }
         await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
         this.info(`Success! Data written to: ${filePath}`)
      } catch (err: any) {
         this.error(`Error writing output to ${filePath}: ${err.message}`)
         throw err
      }
   }
}

export const writeOutput = Skills.writeOutput.bind(Skills)


/**
 * Supported API client protocols/types.
 */
export type ApiClientType = 'rest' | 'xmlrpc';

/**
 * Configuration schema for the API client used by a skill.
 */
export interface SkillApiClientConfig {
  /**
   * The protocol type ('rest' or 'xmlrpc')
   */
  type: ApiClientType;

  /**
   * The target endpoint URL for the API client (e.g. Odoo URL, Brevo URL, etc.)
   */
  endpointUrl: string;

  /**
   * Parameters for initializing the client (e.g., authentication credentials, headers, database names)
   */
  parameters: Record<string, any>;
}

/**
 * Definition of a remote method exposed or called by the skill.
 */
export interface RemoteMethodDefinition {
  /**
   * Name of the method exposed to the skill runner
   */
  name: string;

  /**
   * Purpose of this remote action
   */
  description?: string;

  /**
   * The actual remote endpoint path (for REST, e.g. 'contacts')
   * or the remote procedure call name (for XML-RPC, e.g. 'execute_kw')
   */
  remoteName: string;

  /**
   * HTTP method to use (e.g. 'GET', 'POST', 'PUT', 'DELETE') if using 'rest'
   */
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /**
   * Schema of expected method arguments or query/body parameters
   */
  parameters?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    description?: string;
  }>;
}

/**
 * Represents a skill that leverages an API client (REST or XML-RPC).
 */
export interface ApiSkillDefinition {
  /**
   * Unique name of the skill
   */
  name: string;

  /**
   * Description of the skill functionality
   */
  description: string;

  /**
   * The API client configuration
   */
  client: SkillApiClientConfig;

  /**
   * List of remote methods or endpoints utilized by the skill
   */
  methods: RemoteMethodDefinition[];
}

