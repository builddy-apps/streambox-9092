import crypto from 'crypto';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_ACCESS_EXPIRY = 15 * 60 * 1000;
const JWT_REFRESH_EXPIRY = 7 * 24 * 60 * 60 * 1000;

const createRefreshTokensTable = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
};

createRefreshTokensTable();

export const hashPassword = async (password, salt = null) => {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const derivedKey = await new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
        });
    });
    return `${salt}:${derivedKey.toString('hex')}`;
};

export const verifyPassword = async (password, hashedPassword) => {
    const [salt, hash] = hashedPassword.split(':');
    const derivedKey = await new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
        });
    });
    return derivedKey.toString('hex') === hash;
};

const base64UrlEncode = (str) => {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

const base64UrlDecode = (str) => {
    return Buffer.from(str + '='.repeat((4 - str.length % 4) % 4), 'base64').toString();
};

export const generateToken = (payload, expiresIn) => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Date.now();
    const tokenPayload = {
        ...payload,
        iat: Math.floor(now / 1000),
        exp: Math.floor((now + expiresIn) / 1000)
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(signatureInput)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    return `${signatureInput}.${signature}`;
};

export const verifyToken = (token) => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return { valid: false, error: 'Invalid token format' };
        }

        const [encodedHeader, encodedPayload, signature] = parts;
        const signatureInput = `${encodedHeader}.${encodedPayload}`;

        const expectedSignature = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(signatureInput)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        if (signature !== expectedSignature) {
            return { valid: false, error: 'Invalid signature' };
        }

        const payload = JSON.parse(base64UrlDecode(encodedPayload));

        if (payload.exp < Math.floor(Date.now() / 1000)) {
            return { valid: false, error: 'Token expired' };
        }

        return { valid: true, payload };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

export const generateAuthTokens = (userId) => {
    const accessToken = generateToken({ userId, type: 'access' }, JWT_ACCESS_EXPIRY);
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRY).toISOString();

    const stmt = db.prepare(`
        INSERT INTO refresh_tokens (user_id, token, expires_at)
        VALUES (?, ?, ?)
    `);
    stmt.run(userId, refreshToken, expiresAt);

    return { accessToken, refreshToken };
};

export const refreshAccessToken = (refreshToken) => {
    const stmt = db.prepare(`
        SELECT rt.*, u.id as user_id, u.email
        FROM refresh_tokens rt
        JOIN users u ON rt.user_id = u.id
        WHERE rt.token = ? AND rt.expires_at > datetime('now')
    `);
    const tokenRecord = stmt.get(refreshToken);

    if (!tokenRecord) {
        return { success: false, error: 'Invalid or expired refresh token' };
    }

    const accessToken = generateToken({ userId: tokenRecord.user_id, type: 'access' }, JWT_ACCESS_EXPIRY);

    return { success: true, accessToken };
};

export const revokeRefreshToken = (refreshToken) => {
    const stmt = db.prepare('DELETE FROM refresh_tokens WHERE token = ?');
    stmt.run(refreshToken);
};

export const revokeAllUserTokens = (userId) => {
    const stmt = db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?');
    stmt.run(userId);
};

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const result = verifyToken(token);

    if (!result.valid) {
        return res.status(403).json({ success: false, error: result.error });
    }

    if (result.payload.type !== 'access') {
        return res.status(403).json({ success: false, error: 'Invalid token type' });
    }

    req.userId = result.payload.userId;
    next();
};

export const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        const result = verifyToken(token);
        if (result.valid && result.payload.type === 'access') {
            req.userId = result.payload.userId;
        }
    }
    next();
};