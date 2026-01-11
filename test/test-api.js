// test/test-api.js
// Run this with: node test/test-api.js

import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';
const APP_SECRET = process.env.APP_SECRET || 'your-app-secret-here';

// Generate signature (same as server)
function generateSignature(word, topic, timestamp) {
  const data = `${word}:${topic}:${timestamp}`;
  return crypto.createHmac('sha256', APP_SECRET).update(data).digest('hex');
}

async function testHintGeneration() {
  const word = 'Pizza';
  const topic = 'food';
  const timestamp = Date.now().toString();
  const signature = generateSignature(word, topic, timestamp);

  console.log('🧪 Testing Hint Generation API...\n');
  console.log('Request:');
  console.log(`  Word: ${word}`);
  console.log(`  Topic: ${topic}`);
  console.log(`  Timestamp: ${timestamp}`);
  console.log(`  Signature: ${signature.substring(0, 20)}...`);
  console.log('');

  try {
    const response = await fetch(`${BASE_URL}/api/hints/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Secret': APP_SECRET,
        'X-Signature': signature,
        'X-Timestamp': timestamp,
      },
      body: JSON.stringify({
        word,
        topic,
        difficulty: 'medium',
        language: 'en',
        deviceId: 'test-device-001',
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Success!\n');
      console.log('Hints:');
      data.hints.forEach((hint, i) => {
        console.log(`  ${i + 1}. ${hint}`);
      });
      console.log(`\nCached: ${data.cached}`);
      if (data.fallback) console.log('⚠️  Used fallback hints');
    } else {
      console.log('❌ Error:', data.error);
      console.log('Code:', data.code);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.log('\nMake sure the server is running: npm run dev');
  }
}

// Test without auth (should fail)
async function testWithoutAuth() {
  console.log('\n---\n🔒 Testing without auth (should fail)...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/hints/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        word: 'Pizza',
        topic: 'food',
      }),
    });

    const data = await response.json();
    
    if (!data.success && data.code === 'INVALID_APP_SECRET') {
      console.log('✅ Security working! Unauthorized request blocked.');
    } else {
      console.log('⚠️  Unexpected response:', data);
    }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

// Run tests
testHintGeneration()
  .then(() => testWithoutAuth())
  .then(() => console.log('\n✨ Tests complete!'));
