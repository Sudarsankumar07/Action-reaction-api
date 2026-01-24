// api/hints/generate.js
import {
  generateHints,
  generateFallbackHints,
  getFromCache,
  saveToCache
} from '../../lib/groqClient.js';

// Rate limiting (in-memory, resets on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute per IP

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
    // ✅ STEP 1: Authenticate with Firebase JWT
    const { authenticateRequest, sendAuthError } = await import('../../lib/authMiddleware.js');
    const authResult = await authenticateRequest(req);

    if (!authResult.authenticated) {
      console.log(`❌ Authentication failed: ${authResult.error}`);
      return sendAuthError(res, authResult);
    }

    const firebaseUID = authResult.uid;
    console.log(`✅ Authenticated user: ${firebaseUID}`);

    // STEP 2: Rate limiting by Firebase UID (instead of IP)
    const now = Date.now();

    if (!rateLimitMap.has(firebaseUID)) {
      rateLimitMap.set(firebaseUID, []);
    }
    const requests = rateLimitMap.get(firebaseUID).filter(t => t > now - RATE_LIMIT_WINDOW);
    if (requests.length >= RATE_LIMIT_MAX) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a moment.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }
    requests.push(now);
    rateLimitMap.set(firebaseUID, requests);

    const { word, topic, difficulty = 'medium', language = 'en' } = req.body;

    // Validate inputs
    if (!word || !topic) {
      return res.status(400).json({
        success: false,
        error: 'Word and topic are required',
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
