// api/hints/generate.js
import { 
  generateHints, 
  generateFallbackHints, 
  getFromCache, 
  saveToCache 
} from '../../lib/groqClient.js';

import { 
  verifyAppSecret, 
  verifySignature, 
  isTimestampValid, 
  checkDeviceLimit, 
  checkRateLimit, 
  validateInput 
} from '../../lib/validation.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // ============ SECURITY LAYER 1: App Secret Verification ============
    const appSecret = req.headers['x-app-secret'];
    if (!verifyAppSecret(appSecret)) {
      console.warn('Invalid app secret attempt from:', req.headers['x-forwarded-for']);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'INVALID_APP_SECRET'
      });
    }

    // ============ SECURITY LAYER 2: Request Signature Verification ============
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    
    if (!signature || !timestamp) {
      return res.status(401).json({
        success: false,
        error: 'Missing security headers',
        code: 'MISSING_SIGNATURE'
      });
    }

    // Check timestamp is within 5 minutes (prevents replay attacks)
    if (!isTimestampValid(timestamp)) {
      return res.status(401).json({
        success: false,
        error: 'Request expired',
        code: 'EXPIRED_REQUEST'
      });
    }

    // Verify signature
    const { word, topic, difficulty = 'medium', language = 'en', deviceId } = req.body;
    
    if (!verifySignature(signature, word, topic, timestamp)) {
      console.warn('Invalid signature attempt');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE'
      });
    }

    // ============ SECURITY LAYER 3: Device-based Daily Limit ============
    if (deviceId) {
      const deviceLimitResult = checkDeviceLimit(deviceId);
      if (!deviceLimitResult.allowed) {
        return res.status(429).json({
          success: false,
          error: 'Daily limit reached. Try again tomorrow.',
          code: 'DAILY_LIMIT_EXCEEDED',
          remainingTime: deviceLimitResult.remainingTime
        });
      }
    }

    // ============ SECURITY LAYER 4: IP Rate Limiting ============
    const clientIP = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a moment.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitResult.retryAfter
      });
    }

    // Validate inputs
    const validationError = validateInput(word, topic, difficulty);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError,
        code: 'VALIDATION_ERROR'
      });
    }

    // Check cache first
    const cacheKey = `${word.toLowerCase()}:${topic}:${language}`;
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for: ${cacheKey}`);
      return res.status(200).json({
        success: true,
        hints: cachedResult,
        cached: true
      });
    }

    // Generate hints using Groq
    console.log(`Generating hints for: ${word} (${topic})`);
    const hints = await generateHints(word, topic, difficulty, language);

    // Cache the result
    saveToCache(cacheKey, hints);

    return res.status(200).json({
      success: true,
      hints: hints,
      cached: false
    });

  } catch (error) {
    console.error('API Error:', error.message);
    
    // Return fallback hints on error
    const { word, topic } = req.body || {};
    if (word && topic) {
      const fallbackHints = generateFallbackHints(word, topic);
      return res.status(200).json({
        success: true,
        hints: fallbackHints,
        cached: false,
        fallback: true
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to generate hints',
      code: 'INTERNAL_ERROR'
    });
  }
}
