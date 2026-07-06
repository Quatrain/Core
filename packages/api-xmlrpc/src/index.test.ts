import { XmlRpcClient } from './index';
import xmlrpc from 'xmlrpc';

jest.mock('xmlrpc');

describe('XmlRpcClient', () => {
  let mockClient: { methodCall: jest.Mock };

  beforeEach(() => {
    jest.resetAllMocks();
    mockClient = {
      methodCall: jest.fn(),
    };
    (xmlrpc.createClient as jest.Mock).mockReturnValue(mockClient);
    (xmlrpc.createSecureClient as jest.Mock).mockReturnValue(mockClient);
  });

  it('should instantiate insecure client by default', () => {
    const client = new XmlRpcClient({
      host: 'localhost',
      port: 8069,
      path: '/xmlrpc/2/common',
    });

    expect(client).toBeDefined();
    expect(xmlrpc.createClient).toHaveBeenCalledWith({
      host: 'localhost',
      port: 8069,
      path: '/xmlrpc/2/common',
    });
    expect(xmlrpc.createSecureClient).not.toHaveBeenCalled();
  });

  it('should instantiate secure client when secure is true', () => {
    const client = new XmlRpcClient({
      host: 'localhost',
      port: 8069,
      path: '/xmlrpc/2/common',
      secure: true,
    });

    expect(client).toBeDefined();
    expect(xmlrpc.createSecureClient).toHaveBeenCalledWith({
      host: 'localhost',
      port: 8069,
      path: '/xmlrpc/2/common',
    });
    expect(xmlrpc.createClient).not.toHaveBeenCalled();
  });

  it('should resolve methodCall on success', async () => {
    const client = new XmlRpcClient({
      host: 'localhost',
      port: 8069,
      path: '/xmlrpc/2/common',
    });

    mockClient.methodCall.mockImplementation((method, args, cb) => {
      cb(null, 'success-value');
    });

    const result = await client.methodCall('login', ['db', 'admin', 'password']);
    expect(result).toBe('success-value');
    expect(mockClient.methodCall).toHaveBeenCalledWith(
      'login',
      ['db', 'admin', 'password'],
      expect.any(Function)
    );
  });

  it('should reject methodCall on error', async () => {
    const client = new XmlRpcClient({
      host: 'localhost',
      port: 8069,
      path: '/xmlrpc/2/common',
    });

    const mockError = new Error('Connection refused');
    mockClient.methodCall.mockImplementation((method, args, cb) => {
      cb(mockError, null);
    });

    await expect(
      client.methodCall('login', ['db', 'admin', 'password'])
    ).rejects.toThrow('Connection refused');
  });
});
