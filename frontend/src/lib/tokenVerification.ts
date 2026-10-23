/**
 * AgriTrace Firebase ID Token Verification Utility
 * 
 * Implements the official Firebase ID Token validation specification
 * according to Firebase Admin SDK rules:
 * 1. RS256 algorithm enforcement (strictly rejects HS256, none, and symmetric ciphers).
 * 2. Issuer verification: https://securetoken.google.com/<FIREBASE_PROJECT_ID>
 * 3. Audience verification: matches <FIREBASE_PROJECT_ID>
 * 4. Expiration check (exp > current_timestamp)
 * 5. Subject verification (sub non-empty string)
 * 6. Authorization header format verification (Bearer <token>)
 */

export interface DecodedFirebaseToken {
  header: {
    alg: string;
    kid?: string;
    typ?: string;
  };
  payload: {
    iss: string;
    aud: string;
    sub: string;
    exp: number;
    iat: number;
    auth_time: number;
    email?: string;
    role?: string;
    [key: string]: any;
  };
}

export interface TokenVerificationResult {
  valid: boolean;
  user?: {
    uid: string;
    email?: string;
    role?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export function extractBearerToken(authHeader: string | null | undefined): { token: string | null; error?: string } {
  if (!authHeader) {
    return { token: null, error: 'Missing Authorization header' };
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return { token: null, error: 'Malformed Authorization header. Format must be: Bearer <token>' };
  }

  if (!parts[1] || parts[1].length < 10) {
    return { token: null, error: 'Empty or invalid Bearer token' };
  }

  return { token: parts[1] };
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  if (typeof atob === 'function') {
    return atob(base64);
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export function parseJwtParts(token: string): { header: any; payload: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return { header, payload };
  } catch {
    return null;
  }
}

export function verifyFirebaseTokenStructure(
  token: string,
  expectedProjectId: string,
  currentTimestampSec: number = Math.floor(Date.now() / 1000)
): TokenVerificationResult {
  const parsed = parseJwtParts(token);
  if (!parsed) {
    return {
      valid: false,
      error: {
        code: 'INVALID_JWT',
        message: 'invalid JWT: unable to parse token structure',
      },
    };
  }

  const { header, payload } = parsed;

  // 1. Algorithm check: Firebase ID tokens MUST be signed with RS256
  if (header.alg !== 'RS256') {
    return {
      valid: false,
      error: {
        code: 'UNSUPPORTED_ALGORITHM',
        message: `invalid JWT: unable to parse or verify signature, token signature is invalid: signing method ${header.alg} is invalid (expected RS256)`,
      },
    };
  }

  // 2. Audience check: Must match Firebase project ID
  if (payload.aud !== expectedProjectId) {
    return {
      valid: false,
      error: {
        code: 'INVALID_AUDIENCE',
        message: `Firebase ID token has incorrect audience: expected ${expectedProjectId}, received ${payload.aud}`,
      },
    };
  }

  // 3. Issuer check: Must match https://securetoken.google.com/<projectId>
  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  if (payload.iss !== expectedIssuer) {
    return {
      valid: false,
      error: {
        code: 'INVALID_ISSUER',
        message: `Firebase ID token has incorrect issuer: expected ${expectedIssuer}, received ${payload.iss}`,
      },
    };
  }

  // 4. Expiration check
  if (typeof payload.exp !== 'number' || payload.exp <= currentTimestampSec) {
    return {
      valid: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Firebase ID token has expired. Please refresh credentials.',
      },
    };
  }

  // 5. Subject check
  if (!payload.sub || typeof payload.sub !== 'string') {
    return {
      valid: false,
      error: {
        code: 'INVALID_SUBJECT',
        message: 'Firebase ID token must have a valid non-empty subject (uid).',
      },
    };
  }

  return {
    valid: true,
    user: {
      uid: payload.sub,
      email: payload.email,
      role: payload.role || 'CUSTOMER',
    },
  };
}
