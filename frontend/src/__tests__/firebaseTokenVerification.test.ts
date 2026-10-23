import { describe, it, expect } from 'vitest';
import {
  extractBearerToken,
  verifyFirebaseTokenStructure,
} from '../lib/tokenVerification';

function createMockJwt(header: object, payload: object): string {
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encHeader}.${encPayload}.mockSignatureBytes`;
}

describe('Firebase ID Token Verification', () => {
  const PROJECT_ID = 'agritrace-ab141';
  const now = Math.floor(Date.now() / 1000);

  it('successfully verifies a valid RS256 Firebase ID token', () => {
    const validToken = createMockJwt(
      { alg: 'RS256', typ: 'JWT' },
      {
        iss: `https://securetoken.google.com/${PROJECT_ID}`,
        aud: PROJECT_ID,
        sub: 'user-farmer-123', 
        email: 'farmer@agritrace.dev',
        role: 'FARMER',
        exp: now + 3600,
        iat: now,
        auth_time: now,
      }
    );

    const result = verifyFirebaseTokenStructure(validToken, PROJECT_ID, now);
    expect(result.valid).toBe(true);
    expect(result.user?.uid).toBe('user-farmer-123');
    expect(result.user?.role).toBe('FARMER');
    expect(result.error).toBeUndefined();
  });

  it('rejects unsupported HS256 algorithm with explicit signature invalid error', () => {
    const hs256Token = createMockJwt(
      { alg: 'HS256', typ: 'JWT' },
      {
        iss: `https://securetoken.google.com/${PROJECT_ID}`,
        aud: PROJECT_ID,
        sub: 'user-123',
        exp: now + 3600,
      }
    );

    const result = verifyFirebaseTokenStructure(hs256Token, PROJECT_ID, now);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('UNSUPPORTED_ALGORITHM');
    expect(result.error?.message).toContain('signing method HS256 is invalid (expected RS256)');
  });

  it('rejects expired Firebase ID token', () => {
    const expiredToken = createMockJwt(
      { alg: 'RS256', typ: 'JWT' },
      {
        iss: `https://securetoken.google.com/${PROJECT_ID}`,
        aud: PROJECT_ID,
        sub: 'user-123',
        exp: now - 60, // expired 60 seconds ago
        iat: now - 3660,
      }
    );

    const result = verifyFirebaseTokenStructure(expiredToken, PROJECT_ID, now);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects token with wrong audience / project mismatch', () => {
    const wrongAudienceToken = createMockJwt(
      { alg: 'RS256', typ: 'JWT' },
      {
        iss: 'https://securetoken.google.com/wrong-project',
        aud: 'wrong-project',
        sub: 'user-123',
        exp: now + 3600,
      }
    );

    const result = verifyFirebaseTokenStructure(wrongAudienceToken, PROJECT_ID, now);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('INVALID_AUDIENCE');
    expect(result.error?.message).toContain('expected agritrace-ab141, received wrong-project');
  });

  it('validates Authorization header extraction and rejects malformed headers', () => {
    // Missing
    expect(extractBearerToken(null).error).toBe('Missing Authorization header');
    expect(extractBearerToken('').error).toBe('Missing Authorization header');

    // Malformed
    expect(extractBearerToken('Basic dXNlcjpwYXNz').error).toContain('Malformed Authorization header');
    expect(extractBearerToken('Bearer').error).toContain('Malformed Authorization header');

    // Valid Bearer
    const extracted = extractBearerToken('Bearer valid-token-string-12345');
    expect(extracted.token).toBe('valid-token-string-12345');
    expect(extracted.error).toBeUndefined();
  });
});
