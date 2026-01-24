// lib/authMiddleware.js
import { verifyFirebaseToken, extractBearerToken } from './firebaseAdmin.js';

/**
 * Middleware to verify Firebase JWT token from request headers
 * @param {object} req - Request object
 * @returns {Promise<object>} - Verification result with user info or error
 */
export async function authenticateRequest(req) {
    // Extract Authorization header
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader) {
        return {
            authenticated: false,
            error: 'MISSING_AUTH_HEADER',
            message: 'Authorization header is required',
            statusCode: 401,
        };
    }

    // Extract Bearer token
    const token = extractBearerToken(authHeader);

    if (!token) {
        return {
            authenticated: false,
            error: 'INVALID_AUTH_FORMAT',
            message: 'Authorization header must be: Bearer <token>',
            statusCode: 401,
        };
    }

    // Verify token with Firebase
    const verification = await verifyFirebaseToken(token);

    if (!verification.success) {
        return {
            authenticated: false,
            error: verification.error,
            message: verification.message || 'Invalid or expired token',
            statusCode: 401,
        };
    }

    // Return authenticated user info
    return {
        authenticated: true,
        uid: verification.uid,
        authTime: verification.authTime,
        expiresAt: verification.expiresAt,
    };
}

/**
 * Send authentication error response
 * @param {object} res - Response object
 * @param {object} authResult - Result from authenticateRequest
 */
export function sendAuthError(res, authResult) {
    return res.status(authResult.statusCode || 401).json({
        success: false,
        error: authResult.error,
        message: authResult.message,
    });
}
