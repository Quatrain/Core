import xmlrpc from 'xmlrpc';

export interface XmlRpcClientOptions {
  host: string;
  port: number;
  path: string;
  secure?: boolean;
}

export class XmlRpcClient {
  private client: xmlrpc.Client;

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
