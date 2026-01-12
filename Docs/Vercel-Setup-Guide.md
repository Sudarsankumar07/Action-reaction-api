# Vercel Project Setup Guide - Step by Step

## 📋 Prerequisites

Before starting, make sure you have:
- [ ] A **GitHub account** (https://github.com)
- [ ] A **Vercel account** (we'll create this)
- [ ] **Node.js** installed on your computer (v18+)
- [ ] Your **GROQ_API_KEY** ready

---

## 🚀 Step 1: Create a New GitHub Repository

### 1.1 Go to GitHub
1. Open browser and go to: **https://github.com**
2. Sign in to your account

### 1.2 Create New Repository
1. Click the **"+"** icon in the top-right corner
2. Select **"New repository"**

### 1.3 Fill Repository Details
```
Repository name: action-reaction-api
Description: Secure API proxy for Action Reaction game
Public/Private: Private (recommended)
✅ Add a README file
✅ Add .gitignore → Select "Node"
```

4. Click **"Create repository"**

### 1.4 Copy Repository URL
- Click the green **"Code"** button
- Copy the HTTPS URL (e.g., `https://github.com/YOUR_USERNAME/action-reaction-api.git`)

---

## 🚀 Step 2: Create Project Locally

### 2.1 Open Terminal/Command Prompt

**Windows:** Press `Win + R`, type `cmd`, press Enter
**Or:** Open VS Code Terminal (Ctrl + `)

### 2.2 Navigate to Your Projects Folder
```powershell
cd C:\Users\sudarsan kumar\OneDrive\Desktop
```

### 2.3 Clone the Repository
```powershell
git clone https://github.com/YOUR_USERNAME/action-reaction-api.git
cd action-reaction-api
```

### 2.4 Initialize Node.js Project
```powershell
npm init -y
```

### 2.5 Install Dependencies
```powershell
npm install groq-sdk axios
```

---

## 🚀 Step 3: Create Project Structure

### 3.1 Create Folders and Files

Your project structure should look like this:
```
action-reaction-api/
├── api/
│   └── hints/
│       └── generate.js      ← Main API endpoint
├── lib/
│   ├── groqClient.js        ← Groq API wrapper
│   └── validation.js        ← Input validation
├── .env.local               ← Local secrets (NOT committed)
├── .gitignore               ← Ignore sensitive files
├── vercel.json              ← Vercel configuration
├── package.json             ← Dependencies
└── README.md                ← Documentation
```

### 3.2 Create the Files

I'll provide the code for each file in Step 4 below.

---

## 🚀 Step 4: Create the Server Code

### 4.1 Create `vercel.json` (Root folder)

Create a new file called `vercel.json` in the root:

```json
{
  "version": 2,
  "regions": ["sin1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "POST, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, X-App-Version" }
      ]
    }
  ]
}
```

> **Note:** `"sin1"` = Singapore region (closest to India for low latency)

---

### 4.2 Create `api/hints/generate.js`

Create folders: `api` → `hints` → then create `generate.js`:

```javascript
// api/hints/generate.js
import Groq from 'groq-sdk';
import crypto from 'crypto';

// Initialize Groq client with server-side API key
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// App secret for verification (store in Vercel env vars)
const APP_SECRET = process.env.APP_SECRET || 'your-super-secret-key-change-this';

// In-memory rate limiting (resets on cold start)
const rateLimitMap = new Map();
const deviceLimitMap = new Map(); // Per-device daily limits
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 15; // 15 requests per minute per IP
const DAILY_DEVICE_LIMIT = 200; // 200 requests per day per device

// Simple in-memory cache
const hintCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
    if (!appSecret || appSecret !== APP_SECRET) {
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
    const requestTime = parseInt(timestamp);
    const now = Date.now();
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return res.status(401).json({
        success: false,
        error: 'Request expired',
        code: 'EXPIRED_REQUEST'
      });
    }

    // Verify signature
    const { word, topic, difficulty = 'medium', language = 'en', deviceId } = req.body;
    const expectedSignature = generateSignature(word, topic, timestamp, APP_SECRET);
    
    if (signature !== expectedSignature) {
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

// ============ SECURITY FUNCTIONS ============

// Generate signature for verification
function generateSignature(word, topic, timestamp, secret) {
  const data = `${word}:${topic}:${timestamp}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// Check device daily limit
function checkDeviceLimit(deviceId) {
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
function checkRateLimit(ip) {
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
function validateInput(word, topic, difficulty) {
  if (!word || typeof word !== 'string') {
    return 'Word is required';
  }
  
  if (word.length < 2 || word.length > 50) {
    return 'Word must be between 2-50 characters';
  }
  
  const validTopics = ['food', 'sports', 'movies', 'animals', 'places', 'music', 'general', 'actions', 'objects'];
  if (!topic || !validTopics.includes(topic.toLowerCase())) {
    return `Invalid topic. Must be one of: ${validTopics.join(', ')}`;
  }
  
  const validDifficulties = ['easy', 'medium', 'hard'];
  if (!validDifficulties.includes(difficulty.toLowerCase())) {
    return 'Invalid difficulty. Must be: easy, medium, or hard';
  }
  
  return null;
}

// Cache functions
function getFromCache(key) {
  const cached = hintCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.hints;
  }
  return null;
}

function saveToCache(key, hints) {
  // Limit cache size
  if (hintCache.size > 1000) {
    const firstKey = hintCache.keys().next().value;
    hintCache.delete(firstKey);
  }
  hintCache.set(key, { hints, timestamp: Date.now() });
}

// Generate hints using Groq
async function generateHints(word, topic, difficulty, language) {
  const prompt = buildPrompt(word, topic, difficulty, language);
  
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are a creative game hint generator. Generate progressive hints that help players guess words without revealing them directly. Always respond with exactly 4 numbered hints.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 200,
    temperature: 0.7,
  });

  const content = completion.choices[0].message.content;
  const hints = parseHints(content);
  
  if (hints.length === 4) {
    return hints;
  }
  
  return generateFallbackHints(word, topic);
}

// Build prompt
function buildPrompt(word, topic, difficulty, language) {
  const langInstructions = language === 'ta' 
    ? 'Generate hints in Tamil (தமிழ்) language.'
    : 'Generate hints in English.';

  return `Generate exactly 4 hints for the word "${word}" from category "${topic}".
${langInstructions}

DIFFICULTY LEVELS:
1. HARD: Indirect but relatable (what it's used for, where found) - MAX 10 WORDS
2. MODERATE: Clear category, main characteristics - MAX 10 WORDS  
3. EASY: First letter + length + specific details - MAX 10 WORDS
4. VERY EASY: Partial letters (e.g. "P_ZZ_") + obvious clue - MAX 10 WORDS

RULES:
- Never use the word "${word}"
- Each hint under 10 words
- Number each hint (1. 2. 3. 4.)
- Make it relatable and fun

Now generate 4 hints for "${word}":`;
}

// Parse hints from LLM response
function parseHints(content) {
  const hints = [];
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  for (const line of lines) {
    if (hints.length >= 4) break;
    
    // Match numbered hints: "1. hint" or "1) hint"
    const match = line.match(/^(\d+)[\.\):\-]\s*(.+)$/);
    if (match && match[2].trim().length > 5) {
      hints.push(match[2].trim());
    }
  }
  
  return hints;
}

// Fallback hints
function generateFallbackHints(word, topic) {
  const firstLetter = word[0].toUpperCase();
  const partial = word.split('').map((char, i) => 
    (i === 0 || i === word.length - 1) ? char.toUpperCase() : '_'
  ).join(' ');

  return [
    `Something related to ${topic} that people often encounter`,
    `A ${topic} word with ${word.length} letters`,
    `Starts with "${firstLetter}", ${word.length} letters long`,
    `${partial}`
  ];
}
```

---

### 4.3 Update `package.json`

Replace your `package.json` with:

```json
{
  "name": "action-reaction-api",
  "version": "1.0.0",
  "description": "Secure API proxy for Action Reaction game",
  "type": "module",
  "scripts": {
    "dev": "vercel dev",
    "deploy": "vercel --prod"
  },
  "dependencies": {
    "groq-sdk": "^0.3.0"
  },
  "devDependencies": {
    "vercel": "^32.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

---

### 4.4 Update `.gitignore`

Make sure your `.gitignore` contains:

```gitignore
# Dependencies
node_modules/

# Environment files (IMPORTANT!)
.env
.env.local
.env*.local

# Vercel
.vercel

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

---

### 4.5 Create `.env.local` (for local testing)

Create `.env.local` in the root folder:

```env
GROQ_API_KEY=your_groq_api_key_here
APP_SECRET=your_random_secret_key_here
```

> ⚠️ **IMPORTANT:** This file should NEVER be committed to Git!
> ⚠️ **Change APP_SECRET** to your own random string (use a password generator)
> ⚠️ **Replace** `your_groq_api_key_here` with your actual Groq API key

---

## 🚀 Step 5: Create Vercel Account

### 5.1 Go to Vercel
1. Open browser: **https://vercel.com**
2. Click **"Sign Up"** (top right)

### 5.2 Sign Up with GitHub
1. Click **"Continue with GitHub"**
2. Authorize Vercel to access your GitHub
3. Complete the sign-up process

### 5.3 You're Now on Vercel Dashboard
You should see an empty dashboard with "Let's build something new"

---

## 🚀 Step 6: Push Code to GitHub

### 6.1 Open Terminal in Project Folder

```powershell
cd C:\Users\sudarsan kumar\OneDrive\Desktop\action-reaction-api
```

### 6.2 Add and Commit Files

```powershell
git add .
git commit -m "Initial API proxy setup"
git push origin main
```

If prompted, enter your GitHub username and password (or personal access token).

---

## 🚀 Step 7: Deploy to Vercel

### 7.1 Go to Vercel Dashboard
1. Open: **https://vercel.com/dashboard**
2. Click **"Add New..."** → **"Project"**

### 7.2 Import Git Repository
1. You'll see a list of your GitHub repositories
2. Find **"action-reaction-api"**
3. Click **"Import"**

### 7.3 Configure Project

On the configuration screen:

```
Project Name: action-reaction-api (auto-filled)
Framework Preset: Other
Root Directory: ./ (leave default)
```

### 7.4 Add Environment Variables (IMPORTANT!)

1. Click **"Environment Variables"** section to expand it
2. Add your GROQ API key:

```
Name: GROQ_API_KEY
Value: <paste your actual Groq API key here>
Environment: ✅ Production, ✅ Preview, ✅ Development
```

3. Click **"Add"**

4. Add the APP_SECRET (for request verification):

```
Name: APP_SECRET
Value: <create a strong random password - use a password generator>
Environment: ✅ Production, ✅ Preview, ✅ Development
```

5. Click **"Add"**

### 7.5 Deploy!
1. Click **"Deploy"**
2. Wait 1-2 minutes for deployment
3. You'll see a success screen with your URL!

---

## 🚀 Step 8: Get Your API URL

### 8.1 Find Your Deployment URL

After deployment, you'll see something like:

```
✅ Deployed to: https://action-reaction-api.vercel.app
```

### 8.2 Your API Endpoint

Your hint generation endpoint is now:

```
POST https://action-reaction-api.vercel.app/api/hints/generate
```

---

## 🚀 Step 9: Test Your API

### 9.1 Test with cURL (Terminal)

**Note:** Direct curl will NOT work anymore due to security! You need proper headers:

```powershell
# This will FAIL (expected - security is working!)
curl -X POST https://action-reaction-api.vercel.app/api/hints/generate `
  -H "Content-Type: application/json" `
  -d '{"word": "Pizza", "topic": "food", "difficulty": "medium"}'

# Response: {"success":false,"error":"Unauthorized","code":"INVALID_APP_SECRET"}
```

The API now requires:
- `X-App-Secret` header (your secret key)
- `X-Signature` header (HMAC signature)
- `X-Timestamp` header (current time)

**This is good!** It means hackers can't just use curl anymore.

### 9.2 Test with Postman (Manual Testing)

1. Method: **POST**
2. URL: `https://YOUR-PROJECT.vercel.app/api/hints/generate`
3. Headers: `Content-Type: application/json`
4. Body (JSON):
```json
{
  "word": "Pizza",
  "topic": "food",
  "difficulty": "medium",
  "language": "en"
}
```

### 9.3 Expected Response

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

---

## 🚀 Step 10: Update Your Mobile App

### 10.1 Update `.env` in Action-Reaction App

Open your game's `.env` file:
```
C:\Users\sudarsan kumar\OneDrive\Desktop\Action-Reaction\.env
```

Change it to:

```env
# OLD - REMOVE THESE:
# GROQ_API_KEY=xxx
# GROQ_BASE_URL=https://api.groq.com/openai/v1

# NEW - ADD THESE:
PROXY_BASE_URL=https://action-reaction-api.vercel.app
APP_SECRET=<same secret you set in Vercel>

# Keep these:
GROQ_MODEL=llama-3.3-70b-versatile
ENABLE_HINT_CACHE=true
CACHE_EXPIRY_HOURS=24
USE_STATIC_FALLBACK=true
```

> ⚠️ **APP_SECRET must match** the one you set in Vercel!

### 10.2 I'll Update Your groqService.js

Once you confirm the Vercel deployment is working, I'll update your mobile app code to use the proxy with proper security headers.

---

## 🔒 Security Features Summary

The API is now protected by **4 layers of security**:

| Layer | Protection | What it stops |
|-------|------------|---------------|
| **1. App Secret** | Secret key in header | Random hackers |
| **2. Request Signature** | HMAC-SHA256 signed requests | Replay attacks, tampering |
| **3. Timestamp Check** | Request expires in 5 min | Old/stolen requests |
| **4. Device Daily Limit** | 200 requests/day per device | Abuse from compromised devices |
| **5. IP Rate Limit** | 15 requests/min per IP | Brute force attacks |

### Can a hacker still abuse it?

**To abuse your API, a hacker would need to:**
1. ✅ Find your URL (easy - public)
2. ❌ Extract APP_SECRET from your APK (possible but hard)
3. ❌ Generate valid HMAC signatures (needs the secret)
4. ❌ Send requests within 5-minute window
5. ❌ Stay under rate limits

**Even if they extract the secret:**
- They can only make 200 requests/day per device
- They can only make 15 requests/minute per IP
- Server logs all attempts for monitoring

This is a **good balance** between security and complexity!

---

## 📊 Vercel Dashboard Features

### View Logs
1. Go to: https://vercel.com/dashboard
2. Click your project
3. Click **"Logs"** tab
4. See real-time request logs

### View Analytics
1. Click **"Analytics"** tab
2. See request counts, response times, errors

### Redeploy
1. Push changes to GitHub
2. Vercel auto-deploys! 🎉

---

## 🔧 Troubleshooting

### Error: "GROQ_API_KEY is not defined"
- Go to Vercel Dashboard → Project → Settings → Environment Variables
- Make sure GROQ_API_KEY is added
- Redeploy the project

### Error: "Module not found"
- Make sure `package.json` has `"type": "module"`
- Run `npm install` again

### Error: 404 Not Found
- Check that `api/hints/generate.js` path is correct
- URL should be `/api/hints/generate` (matches folder structure)

### Error: CORS blocked
- Check `vercel.json` has correct CORS headers
- Redeploy after changes

---

## ✅ Checklist Summary

- [ ] Created GitHub repository
- [ ] Cloned repository locally
- [ ] Created project files (api/hints/generate.js, vercel.json, etc.)
- [ ] Pushed code to GitHub
- [ ] Created Vercel account
- [ ] Imported project to Vercel
- [ ] Added GROQ_API_KEY environment variable
- [ ] Deployed successfully
- [ ] Tested API endpoint
- [ ] Updated mobile app .env

---

## 🎉 Done!

Your API is now securely hosted on Vercel! The GROQ_API_KEY is safely stored on the server and never exposed in your mobile app.

**Next Step:** Let me know once you've deployed, and I'll update your mobile app's `groqService.js` to use the new proxy endpoint!

---

*Guide Version: 1.0*  
*Created: January 12, 2026*
