// lib/firebaseAdmin.js
import admin from 'firebase-admin';

let firebaseApp;

/**
 * Initialize Firebase Admin SDK (singleton pattern)
 * Service account credentials come from environment variable
 */
export function initializeFirebase() {
    if (firebaseApp) {
        return firebaseApp;
    }

    try {
        // Check if already initialized
        if (admin.apps.length > 0) {
            firebaseApp = admin.apps[0];
            return firebaseApp;
        }

        // Parse service account from environment variable
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            : null;

        if (!serviceAccount) {
            console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not found. JWT verification will fail.');
            return null;
        }

        // Initialize Firebase Admin
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.FIREBASE_PROJECT_ID || 'action-reaction-game',
        });

        console.log('✅ Firebase Admin initialized successfully');
        return firebaseApp;
    } catch (error) {
        console.error('❌ Firebase Admin initialization failed:', error.message);
        return null;
    }
}

/**
 * Verify Firebase JWT token
 * @param {string} token - The Firebase ID token from Authorization header
 * @returns {Promise<object>} - Decoded token with user info
 */
export async function verifyFirebaseToken(token) {
    try {
        const app = initializeFirebase();
        if (!app) {
            throw new Error('Firebase not initialized');
        }

        // Verify the token with Firebase
        const decodedToken = await admin.auth().verifyIdToken(token);

        return {
            success: true,
            uid: decodedToken.uid,
            authTime: decodedToken.auth_time,
            issuer: decodedToken.iss,
            expiresAt: decodedToken.exp,
        };
    } catch (error) {
        console.error('JWT verification failed:', error.message);

        // Return detailed error info
        return {
            success: false,
            error: error.code || 'INVALID_TOKEN',
            message: error.message,
        };
    }
}

/**
 * Extract Bearer token from Authorization header
 * @param {string} authHeader - The Authorization header value
 * @returns {string|null} - The extracted token or null
 */
export function extractBearerToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') {
        return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
    }

    return null;
}
