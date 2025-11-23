const { DidKey, DidKeyUtils } = require('@web5/dids');


/**
 * Gets the DID from the private key configured in environment variables
 * 
 * Expects PRIVATE_KEY_JWK in environment variables as a JSON string with format:
 * {
 *   "kty": "OKP",
 *   "crv": "Ed25519",
 *   "x": "base64url-encoded-public-key",
 *   "d": "base64url-encoded-private-key"
 * }
 * 
 * @returns {Promise<BearerDid>} A BearerDid object representing the DID
 * @throws {Error} If PRIVATE_KEY_JWK is not configured
 */
async function getDid() {
    const privateKeyJwk = process.env.PRIVATE_KEY_JWK;

    if (!privateKeyJwk) {
        throw new Error(
            'PRIVATE_KEY_JWK debe estar configurado en las variables de entorno.\n' +
            'Formato esperado: JSON string con formato JWK completo:\n' +
            '{\n' +
            '  "kty": "OKP",\n' +
            '  "crv": "Ed25519",\n' +
            '  "x": "base64url-encoded-public-key",\n' +
            '  "d": "base64url-encoded-private-key"\n' +
            '}'
        );
    }

    let privateKeyJwkObj;
    let publicKeyJwkObj;

    try {
        // Parsear el JWK
        const jwk = typeof privateKeyJwk === 'string' ? JSON.parse(privateKeyJwk) : privateKeyJwk;

        if (!jwk.kty || !jwk.crv || !jwk.d || !jwk.x) {
            throw new Error('PRIVATE_KEY_JWK debe contener kty, crv, x (clave pública) y d (clave privada)');
        }

        // Extraer la clave pública (sin 'd')
        publicKeyJwkObj = {
            kty: jwk.kty,
            crv: jwk.crv,
            x: jwk.x
        };

        privateKeyJwkObj = jwk;
    } catch (error) {
        throw new Error(`Error al parsear PRIVATE_KEY_JWK: ${error.message}`);
    }

    // 1. Derivar el DID URI desde la clave pública
    const multibaseId = await DidKeyUtils.publicKeyToMultibaseId({ publicKey: publicKeyJwkObj });
    const didUri = `did:${DidKey.methodName}:${multibaseId}`;

    // 2. Resolver el DID para obtener el documento
    const resolutionResult = await DidKey.resolve(didUri);

    if (!resolutionResult.didDocument) {
        throw new Error(`No se pudo resolver el DID: ${didUri}`);
    }

    // 3. Construir el PortableDid
    const portableDid = {
        uri: didUri,
        document: resolutionResult.didDocument,
        metadata: resolutionResult.didDocumentMetadata || {},
        privateKeys: [privateKeyJwkObj]
    };

    // 4. Importar el DID usando DidKey.import()
    const did = await DidKey.import({ portableDid });

    console.log(`   ✅ DID obtenido desde clave privada: ${did.uri}\n`);
    return did;
}

/**
 * Generates a new Ed25519 key pair and returns the private key JWK
 * formatted as a JSON string suitable for use in environment variables.
 * 
 * This function creates a new DID, exports it to get the private key,
 * and returns it in the format expected by PRIVATE_KEY_JWK.
 * 
 * @returns {Promise<string>} A JSON string containing the JWK with both
 *                            public (x) and private (d) key components
 * 
 * @example
 * ```javascript
 * const privateKeyJwk = await generatePrivateKeyJwk();
 * console.log('Add this to your .env file:');
 * console.log(`PRIVATE_KEY_JWK='${privateKeyJwk}'`);
 * ```
 */
async function generatePrivateKeyJwk() {
    // 1. Crear un nuevo DID con algoritmo Ed25519
    const did = await DidKey.create({ options: { algorithm: 'Ed25519' } });

    // 2. Exportar el DID a formato PortableDid para obtener las claves privadas
    const portableDid = await did.export();

    // 3. Extraer el JWK de la clave privada
    if (!portableDid.privateKeys || portableDid.privateKeys.length === 0) {
        throw new Error('No se encontraron claves privadas en el DID exportado');
    }

    const privateKeyJwk = portableDid.privateKeys[0];

    // 4. Validar que el JWK tenga los campos necesarios
    if (!privateKeyJwk.kty || !privateKeyJwk.crv || !privateKeyJwk.x || !privateKeyJwk.d) {
        throw new Error('El JWK generado no contiene todos los campos necesarios (kty, crv, x, d)');
    }

    // 5. Devolver como string JSON (sin espacios para facilitar copiar al .env)
    return JSON.stringify(privateKeyJwk);
}

/**
 * Generates a new Ed25519 key pair and prints it in a format ready to copy
 * to your .env file. This is a convenience wrapper around generatePrivateKeyJwk().
 * 
 * @returns {Promise<void>}
 */
async function generateAndPrintPrivateKeyJwk() {
    try {
        console.log('\n🔑 Generando nuevo par de claves Ed25519...\n');

        // Crear DID y obtener tanto el JWK como el URI
        const did = await DidKey.create({ options: { algorithm: 'Ed25519' } });
        const portableDid = await did.export();

        if (!portableDid.privateKeys || portableDid.privateKeys.length === 0) {
            throw new Error('No se encontraron claves privadas en el DID exportado');
        }

        const privateKeyJwk = portableDid.privateKeys[0];
        const privateKeyJwkString = JSON.stringify(privateKeyJwk);
        const didUri = portableDid.uri;

        console.log('✅ Clave generada exitosamente!\n');
        console.log('📋 Copia esto a tu archivo .env:\n');
        console.log('─'.repeat(60));
        console.log(`PRIVATE_KEY_JWK='${privateKeyJwkString}'`);
        console.log('─'.repeat(60));
        console.log(`\n🔗 DID asociado: ${didUri}\n`);
        console.log('⚠️  IMPORTANTE: Guarda esta clave de forma segura. No la compartas públicamente.\n');
    } catch (error) {
        console.error('❌ Error al generar la clave:', error.message);
        throw error;
    }
}

function generateEligibilityVC() {

}

module.exports = {
    getDid,
    generateEligibilityVC,
    generatePrivateKeyJwk,
    generateAndPrintPrivateKeyJwk
};