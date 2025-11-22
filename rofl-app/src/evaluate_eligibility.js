#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();


// Input: objeto con { age, hasDiabetes, creatinine }
// Output: true / false
// Reglas de ejemplo para poc

function evaluateEligibility(input) {
    if (!input || !Array.isArray(input.item)) {
        return false;
    }

    const findSection = (linkId) => input.item.find((i) => i.linkId === linkId) || {};
    const findItem = (section, linkId) =>
        (section.item || []).find((i) => i.linkId === linkId) || {};

    const section1 = findSection("1");
    const section2 = findSection("2");
    const section3 = findSection("3");
    const section4 = findSection("4");

    const edadItem = findItem(section1, "1.1");
    const sexoItem = findItem(section1, "1.2");

    const dxPrevioItem = findItem(section2, "2.1");
    const sintomasItem = findItem(section2, "2.2");
    const pruebaCogItem = findItem(section2, "2.3");
    const puntajeItem = findItem(section2, "2.4");

    const antecedentesFamItem = findItem(section3, "3.1");
    const condicionesItem = findItem(section3, "3.2");
    const medicacionesItem = findItem(section3, "3.3");

    const ensayosItem = findItem(section4, "4.1");
    const acvConvItem = findItem(section4, "4.2");
    const otrasDemItem = findItem(section4, "4.3");

    const edad = edadItem.answer?.[0]?.valueInteger;
    const sexo = sexoItem.answer?.[0]?.valueString;
    const diagnosticoPrevio = dxPrevioItem.answer?.[0]?.valueString;
    const sintomas = (sintomasItem.answer || []).map((a) => a.valueString).filter(Boolean);
    const pruebaCognitivaReciente = pruebaCogItem.answer?.[0]?.valueString;
    const puntajePrueba = puntajeItem.answer?.[0]?.valueInteger;

    const antecedentesFamiliares = antecedentesFamItem.answer?.[0]?.valueString;
    const condicionesMedicas = (condicionesItem.answer || []).map((a) => a.valueString).filter(Boolean);
    const medicacionesActuales = (medicacionesItem.answer || []).map((a) => a.valueString).filter(Boolean);

    const participacionEnsayos = ensayosItem.answer?.[0]?.valueString;
    const antecedentesACVConvulsiones = acvConvItem.answer?.[0]?.valueString;
    const otrasDemencias = (otrasDemItem.answer || []).map((a) => a.valueString).filter(Boolean);

    // Regla 1: edad objetivo para Alzheimer temprano / MCI
    if (typeof edad !== "number" || edad < 55 || edad > 85) {
        return false;
    }

    // Regla 2: diagnóstico compatible
    const dxElegibles = [
        "Yes, Alzheimer's disease",
        "Yes, Mild Cognitive Impairment (MCI)",
        "No, but I have symptoms",
    ];
    if (!dxElegibles.includes(diagnosticoPrevio)) {
        return false;
    }

    // Regla 3: al menos un síntoma relevante y no solo "Ninguno de los anteriores"
    if (!Array.isArray(sintomas) || sintomas.length === 0) {
        return false;
    }
    const soloNinguno =
        sintomas.length === 1 && sintomas[0] === "None of the above";
    if (soloNinguno) {
        return false;
    }

    // Regla 4: prueba cognitiva (si hay puntaje, rango compatible)
    if (pruebaCognitivaReciente === "Sí, y tengo el resultado") {
        if (typeof puntajePrueba !== "number") {
            return false;
        }
        if (puntajePrueba < 18 || puntajePrueba > 30) {
            return false;
        }
    }

    // Regla 5: exclusiones duras

    // 5.1 Participación reciente en otros ensayos
    if (participacionEnsayos === "Yes") {
        return false;
    }

    // 5.2 Antecedentes de ACV o convulsiones
    if (antecedentesACVConvulsiones === "Yes") {
        return false;
    }

    // 5.3 Otras demencias distintas a Alzheimer
    const tieneOtraDemencia =
        Array.isArray(otrasDemencias) &&
        otrasDemencias.some((d) => d && d !== "No");
    if (tieneOtraDemencia) {
        return false;
    }

    // 5.4 Ejemplo de exclusión combinando comorbilidades/medicaciones
    const enfermedadCardiaca =
        Array.isArray(condicionesMedicas) &&
        condicionesMedicas.includes("Heart disease");
    const antipsicoticos =
        Array.isArray(medicacionesActuales) &&
        medicacionesActuales.includes("Antipsychotics");
    if (enfermedadCardiaca && antipsicoticos) {
        return false;
    }

    // Si pasa todas las reglas, lo consideramos elegible para el ensayo
    return true;
}

// --- Servidor Express ---

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:3000',
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
app.post('/evaluateEligibility', (req, res) => {
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

        const result = evaluateEligibility(input);

        res.json({
            eligible: result
        });
        console.log('Eligibility evaluated:', result);
    } catch (error) {
        res.status(500).json({
            error: 'Error processing request',
            message: error.message
        });
    }
});

async function resolveDid(did) {
  const resolvedDid = did || 'did:example:patient-123456789abcdef';
  const dwnEndpoint = process.env.MOCK_DWN_ENDPOINT || 'https://mock-dwn.local';

  return {
    did: resolvedDid,
    services: [
      {
        id: '#dwn',
        type: 'DecentralizedWebNode',
        serviceEndpoint: dwnEndpoint,
      },
    ],
  };
}

async function fetchVcFromDwn(didDocument) {
  const dwnService = (didDocument.services || []).find(
    (s) => s.type === 'DecentralizedWebNode'
  );

  return {
    vcId: 'vc-mock-eligibility-001',
    subjectDid: didDocument.did,
    dwnEndpoint: dwnService ? dwnService.serviceEndpoint : null,
    status: 'Pending Evaluation',
  };
}

app.post('/did-login', async (req, res) => {
  try {
    const { did } = req.body || {};

    const didDocument = await resolveDid(did);
    const vc = await fetchVcFromDwn(didDocument);

    res.json({
      ok: true,
      did: didDocument.did,
      dwnEndpoint: vc.dwnEndpoint,
      vc,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Error in did-login',
      message: error.message,
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