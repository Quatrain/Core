import { HttpHelper } from './HttpHelper';

describe('HttpHelper', () => {
  describe('parseBearerToken', () => {
    it('should return empty string when authorization is undefined', () => {
      expect(HttpHelper.parseBearerToken(undefined)).toBe('');
    });

    it('should return empty string when authorization is empty', () => {
      expect(HttpHelper.parseBearerToken('')).toBe('');
    });

    it('should parse bearer token successfully', () => {
      expect(HttpHelper.parseBearerToken('Bearer my-token-123')).toBe('my-token-123');
    });

    it('should return empty string if bearer prefix has no token', () => {
      expect(HttpHelper.parseBearerToken('Bearer')).toBe('');
      expect(HttpHelper.parseBearerToken('Bearer ')).toBe('');
    });

    it('should return empty string if authorization header is malformed', () => {
      expect(HttpHelper.parseBearerToken('my-token-123')).toBe('');
    });
  });

  describe('parseBasicAuth', () => {
    const originalAtob = global.atob;

    afterEach(() => {
      global.atob = originalAtob;
    });

    it('should return null when authorization is undefined', () => {
      expect(HttpHelper.parseBasicAuth(undefined)).toBeNull();
    });

    it('should return null when authorization header is empty', () => {
      expect(HttpHelper.parseBasicAuth('')).toBeNull();
      expect(HttpHelper.parseBasicAuth('Basic')).toBeNull();
      expect(HttpHelper.parseBasicAuth('Basic ')).toBeNull();
    });

    it('should parse basic credentials successfully using Node Buffer', () => {
      // Delete atob to force Node Buffer path
      (global as any).atob = undefined;
      const authHeader = 'Basic ' + Buffer.from('myuser:mypass').toString('base64');
      const result = HttpHelper.parseBasicAuth(authHeader);
      expect(result).toEqual({ user: 'myuser', pass: 'mypass' });
    });

    it('should parse basic credentials successfully using browser atob if defined', () => {
      const mockDecoded = 'browseruser:browserpass';
      const mockB64 = Buffer.from(mockDecoded).toString('base64');
      global.atob = jest.fn().mockReturnValue(mockDecoded);

      const authHeader = `Basic ${mockB64}`;
      const result = HttpHelper.parseBasicAuth(authHeader);

      expect(global.atob).toHaveBeenCalledWith(mockB64);
      expect(result).toEqual({ user: 'browseruser', pass: 'browserpass' });
    });

    it('should return null when decoded value lacks a colon separator', () => {
      (global as any).atob = undefined;
      const authHeader = 'Basic ' + Buffer.from('onlyuser').toString('base64');
      expect(HttpHelper.parseBasicAuth(authHeader)).toBeNull();
    });

    it('should return null when parsing throws an error', () => {
      (global as any).atob = undefined;
      const authHeader = 'Basic invalid@@@base64';
      expect(HttpHelper.parseBasicAuth(authHeader)).toBeNull();
    });
  });
});
