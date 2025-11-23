#!/usr/bin/env node

/**
 * Script de utilidad para generar un nuevo PRIVATE_KEY_JWK
 * 
 * Uso:
 *   node src/generate-key.js
 * 
 * Esto generará un nuevo par de claves Ed25519 y mostrará el JWK
 * formateado para copiar directamente a tu archivo .env
 */

const { generateAndPrintPrivateKeyJwk } = require('./did.js');

// Ejecutar la función
generateAndPrintPrivateKeyJwk()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });

