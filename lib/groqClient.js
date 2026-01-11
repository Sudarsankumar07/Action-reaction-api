// lib/groqClient.js
import Groq from 'groq-sdk';

// Initialize Groq client with server-side API key
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Simple in-memory cache
const hintCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Cache functions
export function getFromCache(key) {
  const cached = hintCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.hints;
  }
  return null;
}

export function saveToCache(key, hints) {
  // Limit cache size
  if (hintCache.size > 1000) {
    const firstKey = hintCache.keys().next().value;
    hintCache.delete(firstKey);
  }
  hintCache.set(key, { hints, timestamp: Date.now() });
}

// Build prompt for hint generation
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

// Fallback hints when API fails
export function generateFallbackHints(word, topic) {
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

// Generate hints using Groq
export async function generateHints(word, topic, difficulty, language) {
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
