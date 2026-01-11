# Action Reaction API

A secure serverless API proxy for the Action Reaction game that generates word hints using GROQ's LLM while keeping API keys safe on the server.

## 🎯 Purpose

This API acts as a secure middleware between the mobile game and GROQ's AI service:
- **Hides API keys** from the mobile app (no exposed secrets in APK)
- **Generates progressive hints** for word-guessing gameplay
- **Multi-layer security** prevents API abuse

## 🏗️ Project Structure

```
action-reaction-api/
├── api/
│   └── hints/
│       └── generate.js      # Main API endpoint
├── lib/
│   ├── groqClient.js        # Groq API wrapper & caching
│   └── validation.js        # Security & input validation
├── test/
│   └── test-api.js          # API testing script
├── .env.local               # Local secrets (not committed)
├── .gitignore
├── vercel.json              # Vercel deployment config
├── package.json
└── README.md
```

## 🔒 Security Features

| Layer | Protection | Description |
|-------|------------|-------------|
| **App Secret** | `X-App-Secret` header | Validates requests come from your app |
| **Request Signature** | `X-Signature` header | HMAC-SHA256 signed requests prevent tampering |
| **Timestamp Check** | `X-Timestamp` header | Requests expire in 5 minutes (prevents replay attacks) |
| **Device Daily Limit** | 200 req/day | Per-device rate limiting |
| **IP Rate Limit** | 15 req/min | Per-IP rate limiting |

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local` in the root folder:

```env
GROQ_API_KEY=your-groq-api-key-here
APP_SECRET=your-random-secret-key-here
```

### 3. Run Locally

```bash
npm run dev
```

### 4. Deploy to Vercel

```bash
npm run deploy
```

Or connect your GitHub repo to Vercel for automatic deployments.

## 📡 API Endpoint

### POST `/api/hints/generate`

Generates 4 progressive hints for a given word.

#### Required Headers

```
Content-Type: application/json
X-App-Secret: your-app-secret
X-Signature: hmac-sha256-signature
X-Timestamp: unix-timestamp-ms
```

#### Request Body

```json
{
  "word": "Pizza",
  "topic": "food",
  "difficulty": "medium",
  "language": "en",
  "deviceId": "unique-device-id"
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `word` | string | ✅ | The word to generate hints for (2-50 chars) |
| `topic` | string | ✅ | Category: `food`, `sports`, `movies`, `animals`, `places`, `music`, `general`, `actions`, `objects` |
| `difficulty` | string | ❌ | `easy`, `medium`, `hard` (default: `medium`) |
| `language` | string | ❌ | `en` or `ta` (Tamil) (default: `en`) |
| `deviceId` | string | ❌ | Unique device ID for daily limits |

#### Success Response

```json
{
  "success": true,
  "hints": [
    "Italian dish often shared at parties and gatherings",
    "Popular round food with cheese and tomato base",
    "Starts with P, 5 letters, sliced Italian bread",
    "P _ Z Z A"
  ],
  "cached": false
}
```

#### Error Responses

| Code | Error | Description |
|------|-------|-------------|
| 401 | `INVALID_APP_SECRET` | Missing or wrong app secret |
| 401 | `MISSING_SIGNATURE` | Missing security headers |
| 401 | `EXPIRED_REQUEST` | Timestamp too old (>5 min) |
| 401 | `INVALID_SIGNATURE` | Signature verification failed |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests per minute |
| 429 | `DAILY_LIMIT_EXCEEDED` | Daily device limit reached |
| 400 | `VALIDATION_ERROR` | Invalid input parameters |

## 🔐 Generating Request Signatures

The signature is an HMAC-SHA256 hash of `word:topic:timestamp` using your `APP_SECRET`:

```javascript
const crypto = require('crypto');

function generateSignature(word, topic, timestamp, appSecret) {
  const data = `${word}:${topic}:${timestamp}`;
  return crypto.createHmac('sha256', appSecret).update(data).digest('hex');
}

// Example usage
const timestamp = Date.now().toString();
const signature = generateSignature('Pizza', 'food', timestamp, 'your-app-secret');
```

## ⚙️ Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Your GROQ API key |
| `APP_SECRET` | Secret key for request verification |

## 📦 Dependencies

- **groq-sdk** - GROQ API client for LLM interactions
- **vercel** - Deployment platform (dev dependency)

## 🌏 Deployment Region

Configured for **Singapore (sin1)** region in `vercel.json` for low latency in Asia.

## 📝 License

ISC