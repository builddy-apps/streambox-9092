import crypto from 'crypto';
import db from './db.js';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

// Rate limiting store (in-memory)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now - value.firstAttempt > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Rate limiter middleware for auth endpoints
export function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `auth:${ip}`;
  
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record) {
    rateLimitStore.set(key, { count: 1, firstAttempt: now });
    return next();
  }
  
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW) {
    record.count = 1;
    record.firstAttempt = now;
    return next();
  }
  
  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const resetTime = Math.ceil((record.firstAttempt + RATE_LIMIT_WINDOW - now) / 1000);
    return res.status(429).json({
      success: false,
      error: `Too many attempts. Try again in ${resetTime} seconds.`
    });
  }
  
  record.count++;
  return next();
}

// Password hashing using crypto.scrypt
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return salt + ':' + derivedKey.toString('hex');
}

// Password verification
export function comparePassword(password, hash) {
  const parts = hash.split(':');
  if (parts.length !== 2) return false;
  
  const salt = parts[0];
  const storedKey = parts[1];
  
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(
    Buffer.from(storedKey, 'hex'),
    derivedKey
  );
}

// Base64URL encoding helper
function base64UrlEncode(data) {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Base64URL decoding helper
function base64UrlDecode(data) {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf-8');
}

// JWT token generation
export function generateToken(payload) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const now = Date.now();
  const tokenPayload = {
    ...payload,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + ACCESS_TOKEN_EXPIRY) / 1000)
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  
  const signatureData = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureData)
    .digest('hex');
  const encodedSignature = base64UrlEncode(signature);
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// JWT token verification
export function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    
    // Verify signature
    const signatureData = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(signatureData)
      .digest('hex');
    const expectedEncodedSignature = base64UrlEncode(expectedSignature);
    
    if (encodedSignature !== expectedEncodedSignature) return null;
    
    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    
    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    
    return payload;
  } catch (error) {
    return null;
  }
}

// Generate refresh token
export function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Store refresh token in database
export function storeRefreshToken(userId, token) {
  const stmt = db.prepare(`
    INSERT INTO refresh_tokens (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY).toISOString();
  stmt.run(userId, token, expiresAt);
}

// Verify refresh token against database
export function verifyRefreshToken(token) {
  const stmt = db.prepare(`
    SELECT user_id, expires_at FROM refresh_tokens
    WHERE token = ? AND deleted_at IS NULL
  `);
  const result = stmt.get(token);
  
  if (!result) return null;
  
  // Check expiration
  if (new Date(result.expires_at) < new Date()) {
    return null;
  }
  
  return result.user_id;
}

// Delete refresh token (logout)
export function deleteRefreshToken(token) {
  const stmt = db.prepare(`
    UPDATE refresh_tokens SET deleted_at = ?
    WHERE token = ?
  `);
  stmt.run(new Date().toISOString(), token);
}

// Clean expired refresh tokens
export function cleanExpiredRefreshTokens() {
  const stmt = db.prepare(`
    DELETE FROM refresh_tokens
    WHERE expires_at < ? OR deleted_at IS NOT NULL
  `);
  stmt.run(new Date().toISOString());
}

// Authentication middleware
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }
  
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
  
  // Attach user info to request
  req.user = payload;
  next();
}

// Optional authentication (doesn't fail if no token)
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  
  next();
}

// Generate both access and refresh tokens
export function generateAuthTokens(user) {
  const payload = {
    userId: user.id,
    email: user.email
  };
  
  const accessToken = generateToken(payload);
  const refreshToken = generateRefreshToken();
  
  return { accessToken, refreshToken };
}