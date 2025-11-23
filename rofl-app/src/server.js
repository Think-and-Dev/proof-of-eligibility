#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();
const evaluateEligibility = require('./evaluate_eligibility');
const { getDid, generateEligibilityVC } = require('./did');

// --- Servidor Express ---

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Middleware para parsear JSON
app.use(express.json());

// Utilidades de cifrado/descifrado (AES-256-GCM)
function getEncryptionKeyBuffer() {
  const keyBase64 = process.env.ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error('ENCRYPTION_KEY is not defined in environment variables');
  }
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte base64-encoded key (AES-256)');
  }
  return key;
}

function decryptPayload(encrypted) {
  if (!encrypted || typeof encrypted !== 'object') {
    throw new Error('Invalid encrypted payload');
  }

  const { iv, ciphertext, authTag } = encrypted;
  if (!iv || !ciphertext) {
    throw new Error('Missing iv or ciphertext fields in encrypted payload');
  }

  const key = getEncryptionKeyBuffer();
  const ivBuf = Buffer.from(iv, 'base64');
  const cipherBuf = Buffer.from(ciphertext, 'base64');

  // Si el authTag viene separado
  let dataBuf = cipherBuf;
  let tagBuf = null;
  if (authTag) {
    tagBuf = Buffer.from(authTag, 'base64');
  } else if (cipherBuf.length > 16) {
    // Convention: last 16 bytes are the auth tag
    tagBuf = cipherBuf.subarray(cipherBuf.length - 16);
    dataBuf = cipherBuf.subarray(0, cipherBuf.length - 16);
  } else {
    throw new Error('Invalid ciphertext length for AES-GCM');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf);
  decipher.setAuthTag(tagBuf);

  const decrypted = Buffer.concat([decipher.update(dataBuf), decipher.final()]);
  const asString = decrypted.toString('utf8');
  return JSON.parse(asString);
}

// Endpoint POST para evaluar elegibilidad
app.post('/evaluateEligibility', async (req, res) => {
  try {
    console.log('Evaluating eligibility...');

    // Se espera un objeto cifrado { iv, ciphertext, authTag? }
    const encrypted = req.body;
    console.log('Received encrypted payload:', encrypted);

    const input = decryptPayload(encrypted);
    console.log('Decrypted payload:', input);
    // Validar que el body tenga los campos necesarios
    if (!input || typeof input !== 'object') {
      return res.status(400).json({
        error: 'Request body must be a valid JSON object'
      });
    }

    const eligibility = evaluateEligibility(input);

    console.log('Eligibility:', eligibility);

    const localDid = await getDid();

    console.log('Local DID:', localDid.uri);

    const vc = await generateEligibilityVC(localDid, eligibility);

    res.json(vc);
    console.log('Eligibility VC generated:', vc);
  } catch (error) {
    res.status(500).json({
      error: 'Error processing request',
      message: error.message
    });
  }
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});


// Start server
app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});