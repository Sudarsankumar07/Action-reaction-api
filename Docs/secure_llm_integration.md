
# Secure LLM Integration for a Public Android Game (No Login)

## 1. Purpose
This document explains how to securely use an LLM (Large Language Model) in a public Android game published on Google Play Store, without requiring user login, while fully protecting the LLM API key from misuse.

This approach follows industry-standard game security practices and is compliant with Google Play policies

## 2. Problem

# The game is:

Public
Does not require sign-in
Uses an LLM that requires a secret API key

# If the API key is placed in the app or called directly, it can be:

Extracted from the APK
Abused by bots
Used by third parties, causing high costs
# What Must NOT Be Done

Do not store the LLM API key in the app
Do not call the LLM directly from Android
Do not expose an unauthenticated backend endpoint

## 3. Architecture
Android Game (No Login UI)
        ↓
Firebase Anonymous Authentication
        ↓
JWT (Auto-generated, short-lived)
        ↓
Secure Backend (Vercel / Node.js)
        ↓
LLM Provider (API Key stored securely)

## 4. Core Concept
"No Login" ≠ "No Authentication"

Even though the user does not see a login screen, the app authenticates silently using Firebase Anonymous Authentication.

This provides:

A unique identity per install
A Google-signed JWT
Automatic token expiry and refresh

## 5. Firebase Setup

# 5.1 Why Firebase Is Required

Firebase is used only for:
Anonymous authentication
JWT generation
Firebase is not used for:
Database
Storage
Analytics (optional)

# 5.2 Firebase Configuration Steps

Create a Firebase project
Add Android app (package name must match)
Download google-services.json
Enable Authentication → Anonymous
Add Firebase Auth SDK to Android

## 6. Android App

# 6.1 Silent Authentication Flow

On game launch:
Firebase signs the user in anonymously
Firebase issues a JWT
JWT is stored in memory (not permanent storage)

# 6.2 Key Rules (Android)

JWT is never shown to the user
JWT is never hardcoded
JWT is sent only via HTTPS

## 7. Backend

# 7.1 Why a Backend Is Mandatory

The backend acts as a secure gatekeeper:
Verifies JWT
Applies rate limits
Calls the LLM securely
The LLM API key exists only here.

# 7.2 Backend Responsibilities

Verify Firebase JWT on every request
Reject unauthenticated or expired tokens
Apply per-user rate limits
Call the LLM using environment variables

## 8. JWT

# 8.1 What JWT Represents

A JWT represents:
A real app installation
A valid Firebase identity
A temporary, signed permission

# 8.2 JWT Properties

Signed by Google (cannot be forged)
Short-lived (~1 hour)
Automatically refreshed
Contains a unique user ID (UID)

## 9. LLM Key

# 9.1 Where the LLM Key Is Stored

Stored as an environment variable on the backend
Never sent to the client
Never logged

# 9.2 How the LLM Is Accessed

Android → Backend (JWT required)
Backend → LLM (API key used internally)

## 10. Protection
| Protection       | Purpose               |
| ---------------- | --------------------- |
| JWT Verification | Blocks fake clients   |
| Rate Limiting    | Controls cost         |
| Anonymous UID    | Tracks per player     |
| HTTPS            | Prevents interception |


## 11. Compliance

This design:
Does not expose secrets
Does not require visible login
Uses Google-recommended authentication
Prevents backend abuse
✔ Fully compliant with Play Store policies

## 12. FAQ

Q: What if user reinstalls the game?
A new anonymous identity is created. This is expected behavior.

Q: Can someone steal the JWT?
JWT expires quickly
Backend verifies signature
Rate limits reduce damage

Q: Why not use a static API key?
Cannot identify users
Cannot be revoked safely
Easily abused

## 13. Summary

The game shows no login UI
Authentication happens silently
JWT secures backend access
LLM API key is fully protected
Architecture is production-grade

## 14. Enhancements
Play Integrity API (anti-mod APK)
Daily usage quotas per player
Abuse detection and auto-blocking
Optional guest-to-account upgrade
