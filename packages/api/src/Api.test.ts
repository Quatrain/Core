import { Api } from './Api';
import { ServerAdapter, EndpointHandler, EndpointOptions } from './types';

class MockServerAdapter implements ServerAdapter {
  get(path: string, handler: any): void {}
  post(path: string, handler: any): void {}
  put(path: string, handler: any): void {}
  delete(path: string, handler: any): void {}
  use(middleware: any): void {}
  createRouter(path: string): ServerAdapter {
    return this;
  }
  start(port: number, callback?: () => void): void {
    if (callback) callback();
  }
  getNativeInstance(): any {
    return null;
  }
  serveStatic(folderPath: string, apiPrefix?: string): void {}
  addEndpoint(handler: EndpointHandler, endpointRoot: string, options?: EndpointOptions): void {}
}

describe('Api Registry', () => {
  it('should register and retrieve a server adapter', () => {
    const mockServer = new MockServerAdapter();
    Api.addServer(mockServer, 'test-server');

    const retrieved = Api.getServer('test-server');
    expect(retrieved).toBe(mockServer);
  });

  it('should register and retrieve a default server adapter', () => {
    const mockServer = new MockServerAdapter();
    Api.addServer(mockServer); // defaults to 'default'

    const retrieved = Api.getServer();
    expect(retrieved).toBe(mockServer);
  });

  it('should throw an error when retrieving a non-existent server adapter', () => {
    expect(() => {
      Api.getServer('non-existent');
    }).toThrow("Server 'non-existent' not found");
  });
});
