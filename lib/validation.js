// lib/validation.js
import crypto from 'crypto';

// App secret for verification (store in Vercel env vars)
const APP_SECRET = process.env.APP_SECRET || 'your-super-secret-key-change-this';

// Rate limiting configuration
const rateLimitMap = new Map();
const deviceLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 15; // 15 requests per minute per IP
const DAILY_DEVICE_LIMIT = 200; // 200 requests per day per device

// Valid topics and difficulties
const VALID_TOPICS = ['food', 'sports', 'movies', 'animals', 'places', 'music', 'general', 'actions', 'objects'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

// Generate signature for verification
export function generateSignature(word, topic, timestamp, secret = APP_SECRET) {
  const data = `${word}:${topic}:${timestamp}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// Verify app secret
export function verifyAppSecret(appSecret) {
  return appSecret && appSecret === APP_SECRET;
}

// Verify request signature
export function verifySignature(signature, word, topic, timestamp) {
  const expectedSignature = generateSignature(word, topic, timestamp);
  return signature === expectedSignature;
}

// Check if timestamp is within valid window (5 minutes)
export function isTimestampValid(timestamp) {
  const requestTime = parseInt(timestamp);
  const now = Date.now();
  return !isNaN(requestTime) && Math.abs(now - requestTime) <= 5 * 60 * 1000;
}

// Check device daily limit
export function checkDeviceLimit(deviceId) {
  const today = new Date().toDateString();
  const key = `${deviceId}:${today}`;
  
  if (!deviceLimitMap.has(key)) {
    deviceLimitMap.set(key, 0);
    
    // Clean up old entries (from previous days)
    for (const [k] of deviceLimitMap) {
      if (!k.endsWith(today)) {
        deviceLimitMap.delete(k);
      }
    }
  }
  
  const count = deviceLimitMap.get(key);
  if (count >= DAILY_DEVICE_LIMIT) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const remainingTime = tomorrow.getTime() - Date.now();
    
    return { allowed: false, remainingTime };
  }
  
  deviceLimitMap.set(key, count + 1);
  return { allowed: true };
}

// Rate limiting function (per IP)
export function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip).filter(time => time > windowStart);
  rateLimitMap.set(ip, requests);
  
  if (requests.length >= RATE_LIMIT_MAX) {
    const oldestRequest = requests[0];
    const retryAfter = Math.ceil((oldestRequest + RATE_LIMIT_WINDOW - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  requests.push(now);
  return { allowed: true };
}

// Input validation
export function validateInput(word, topic, difficulty) {
  if (!word || typeof word !== 'string') {
    return 'Word is required';
  }
  
  if (word.length < 2 || word.length > 50) {
    return 'Word must be between 2-50 characters';
  }
  
  if (!topic || !VALID_TOPICS.includes(topic.toLowerCase())) {
    return `Invalid topic. Must be one of: ${VALID_TOPICS.join(', ')}`;
  }
  
  if (!VALID_DIFFICULTIES.includes(difficulty.toLowerCase())) {
    return 'Invalid difficulty. Must be: easy, medium, or hard';
  }
  
  return null;
}
