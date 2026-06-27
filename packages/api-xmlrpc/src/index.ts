import xmlrpc from 'xmlrpc';

/**
 * Configuration options required to instantiate the XML-RPC client.
 */
export interface XmlRpcClientOptions {
  /** The hostname or IP address of the target server. */
  host: string;
  /** The connection port (e.g. 80 or 443). */
  port: number;
  /** The endpoint path for remote procedures (e.g. '/xmlrpc/2/common'). */
  path: string;
  /** Whether to use a secure HTTPS connection. Defaults to false. */
  secure?: boolean;
}

/**
 * Promise-based wrapper around the XML-RPC protocol client.
 */
export class XmlRpcClient {
  private client: xmlrpc.Client;

  /**
   * Instantiates a new XML-RPC client with the specified configuration options.
   * 
   * @param options - The connection settings.
   */
  constructor(options: XmlRpcClientOptions) {
    const clientOptions = {
      host: options.host,
      port: options.port,
      path: options.path,
    };

    this.client = options.secure
      ? xmlrpc.createSecureClient(clientOptions)
      : xmlrpc.createClient(clientOptions);
  }

  /**
   * Performs an XML-RPC method call and returns a Promise resolving to the value.
   * 
   * @param method - The name of the remote procedure to execute.
   * @param args - The arguments array to pass to the remote procedure.
   * @returns A promise resolving to the result of the method call.
   */
  async methodCall(method: string, args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.methodCall(method, args, (err, value) => {
        if (err) {
          reject(err);
        } else {
          resolve(value);
        }
      });
    });
  }
}

