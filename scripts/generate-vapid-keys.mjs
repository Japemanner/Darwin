#!/usr/bin/env node
// Generates a VAPID key pair (RFC 8292) for Web Push (feature 018).
//
// Run once per environment:
//   node scripts/generate-vapid-keys.mjs
//
// Output:
//   VAPID_KEYS        — JWK pair, store as a Supabase secret (never commit)
//   VAPID_PUBLIC_KEY  — base64url raw public key, used by the browser
//   VAPID_SUBJECT     — mailto: contact address for the push services
//
// The private key never belongs in .env.local, the frontend bundle or the repo.

import { webcrypto } from 'node:crypto'

const { subtle } = webcrypto

const keyPair = await subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
)

const publicKey = await subtle.exportKey('jwk', keyPair.publicKey)
const privateKey = await subtle.exportKey('jwk', keyPair.privateKey)
const publicKeyRaw = Buffer.from(await subtle.exportKey('raw', keyPair.publicKey)).toString('base64url')

console.log('VAPID_KEYS:')
console.log(JSON.stringify({ publicKey, privateKey }))
console.log('')
console.log('VAPID_PUBLIC_KEY (frontend, non-secret):')
console.log(publicKeyRaw)
console.log('')
console.log('VAPID_SUBJECT (example):')
console.log('mailto:beheer@example.nl')
console.log('')
console.log('Next steps:')
console.log('  supabase secrets set VAPID_KEYS=\'<the JSON above>\'')
console.log('  supabase secrets set VAPID_SUBJECT=\'mailto:beheer@example.nl\'')
console.log('  supabase secrets set PUSH_SEND_TOKEN=\'<openssl rand -hex 32>\'')
console.log('  VITE_VAPID_PUBLIC_KEY=<the base64url key above> in .env.local and Netlify')
