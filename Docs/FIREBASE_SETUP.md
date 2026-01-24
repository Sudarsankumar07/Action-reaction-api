# Firebase Authentication Integration - Setup Guide

## ✅ Backend Implementation Complete!

I've implemented Firebase JWT authentication for your Vercel API. Here's what was done:

### Backend Changes Made:

1. ✅ **Added Firebase Admin SDK** (`package.json`)
2. ✅ **Created JWT verification module** (`lib/firebaseAdmin.js`)
3. ✅ **Created authentication middleware** (`lib/authMiddleware.js`)
4. ✅ **Updated API endpoint** (`api/hints/generate.js`)
   - Now requires `Authorization: Bearer <firebase-jwt>` header
   - Rate limiting now uses Firebase UID (not IP address)
5. ✅ **Installed dependencies** (firebase-admin@12.0.0)

---

## 🔥 Next Steps for You

### Step 1: Get Firebase Service Account Key (Backend)

You need the Firebase Admin SDK private key for the backend to verify JWT tokens.

**Instructions:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **action-reaction-game**
3. Click **⚙️ Settings** → **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file (e.g., `action-reaction-game-firebase-adminsdk-xxxxx.json`)
7. **Keep this file SECRET** - never commit to Git!

**What to do with it:**

You'll add the **entire contents** of this JSON file as an environment variable in Vercel. I'll show you how in Step 3.

---

### Step 2: Copy `google-services.json` to Android App

This file configures Firebase in your Android app.

**Manual Action Required:**

1. Find the file: `C:\Users\sudarsan kumar\OneDrive\Desktop\Action-reaction-api\google-services (2).json`
2. **Rename it** to `google-services.json` (remove the " (2)")
3. **Copy it** to: `C:\Users\sudarsan kumar\OneDrive\Desktop\Action-Reaction\google-services.json`

> **Note:** This file should be in the **root of your Android/React Native project**, NOT in the API folder.

---

### Step 3: Configure Vercel Environment Variables

After deploying, you need to add these environment variables in Vercel:

**Go to:** Vercel Dashboard → Your Project → Settings → Environment Variables

Add these 3 variables:

| Variable Name | Value | Where to Get It |
|---------------|-------|-----------------|
| `GROQ_API_KEY` | `your-groq-api-key` | Your existing GROQ key |
| `FIREBASE_PROJECT_ID` | `action-reaction-game` | From firebase console |
| `FIREBASE_SERVICE_ACCOUNT` | `{entire JSON from Step 1}` | The service account JSON |

**For `FIREBASE_SERVICE_ACCOUNT`:**
- Open the JSON file from Step 1
- Copy the **entire contents** (it should start with `{"type": "service_account"...`)
- Paste it as a single line in Vercel

---

### Step 4: Update Android App (React Native)

I need to add Firebase SDK to your Android app. Here's what needs to be done:

**Files I need to modify:**

1. `Action-Reaction/package.json` - Add Firebase dependencies
2. `Action-Reaction/app.json` - Add Firebase plugin
3. **NEW:** `Action-Reaction/src/services/firebaseAuth.js` - Authentication service
4. **MODIFY:** `Action-Reaction/src/services/apiService.js` - Add JWT to requests
5. **MODIFY:** `Action-Reaction/App.js` - Initialize Firebase on launch

**Can you tell me:**
- Do you want me to create these files/changes in your Android app?
- Or would you prefer me to provide you the code snippets to copy manually?

---

## 📋 Summary of What You Need to Do

- [ ] **Download Firebase Service Account Key** (Step 1)
- [ ] **Copy `google-services.json` to Android app** (Step 2)
- [ ] **Add environment variables to Vercel** (Step 3)
- [ ] **Let me update your Android app code** (Step 4)
- [ ] **Deploy to Vercel**
- [ ] **Test the authentication**

---

## 🚀 What Happens After Setup

### Current Flow (Insecure - Removed):
```
Android App → [App Secret] → Vercel API
```

### New Flow (Secure - Implemented):
```
Android App → Firebase Auth → [Get JWT] → API Call with JWT → Vercel Verifies JWT → GROQ
```

**Benefits:**
- ✅ No secrets in the Android APK
- ✅ JWT tokens can't be forged (signed by Google)
- ✅ Automatic token expiry and refresh
- ✅ Per-user rate limiting (using Firebase UID)
- ✅ Production-grade security

---

## 💰 Cost Breakdown

| Service | Cost |
|---------|------|
| Firebase Authentication | **FREE** (unlimited anonymous users) |
| Firebase Storage | **FREE** (not using) |
| Firebase Database | **FREE** (not using) |
| Vercel Serverless Functions | **FREE** (up to 100k invocations/month) |
| GROQ API | **FREE tier available** |

**Total Monthly Cost: $0** (within free tiers)

---

## ❓ Questions?

Let me know if you:
1. Need help getting the Firebase service account key
2. Want me to implement the Android app changes
3. Have issues deploying to Vercel
4. Need help testing the authentication

I'm ready to continue! 🚀
