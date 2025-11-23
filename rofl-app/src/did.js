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
            'PRIVATE_KEY_JWK must be configured in environment variables.\n' +
            'Expected format: JSON string with JWK complete format:\n' +
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
        // Parse the JWK
        const jwk = typeof privateKeyJwk === 'string' ? JSON.parse(privateKeyJwk) : privateKeyJwk;

        if (!jwk.kty || !jwk.crv || !jwk.d || !jwk.x) {
            throw new Error('PRIVATE_KEY_JWK must contain kty, crv, x (public key) and d (private key)');
        }

        // Extract the public key (without 'd')
        publicKeyJwkObj = {
            kty: jwk.kty,
            crv: jwk.crv,
            x: jwk.x
        };

        privateKeyJwkObj = jwk;
    } catch (error) {
        throw new Error(`Error parsing PRIVATE_KEY_JWK: ${error.message}`);
    }

    // 1. Derive the DID URI from the public key
    const multibaseId = await DidKeyUtils.publicKeyToMultibaseId({ publicKey: publicKeyJwkObj });
    const didUri = `did:${DidKey.methodName}:${multibaseId}`;

    // 2. Resolve the DID to get the document
    const resolutionResult = await DidKey.resolve(didUri);

    if (!resolutionResult.didDocument) {
        throw new Error(`Could not resolve the DID: ${didUri}`);
    }

    // 3. Construct the PortableDid
    const portableDid = {
        uri: didUri,
        document: resolutionResult.didDocument,
        metadata: resolutionResult.didDocumentMetadata || {},
        privateKeys: [privateKeyJwkObj]
    };

    // 4. Import the DID using DidKey.import()
    const did = await DidKey.import({ portableDid });

    console.log(`   ✅ DID obtained from private key: ${did.uri}\n`);
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
    // 1. Create a new did using Ed25519
    const did = await DidKey.create({ options: { algorithm: 'Ed25519' } });

    // 2. Export did to a portable did to get private keys
    const portableDid = await did.export();

    // 3. Extract pks
    if (!portableDid.privateKeys || portableDid.privateKeys.length === 0) {
        throw new Error('No private keys found in the exported DID');
    }

    const privateKeyJwk = portableDid.privateKeys[0];

    // 4. Validate that the JWK has the necessary fields
    if (!privateKeyJwk.kty || !privateKeyJwk.crv || !privateKeyJwk.x || !privateKeyJwk.d) {
        throw new Error('The generated JWK does not contain all the necessary fields (kty, crv, x, d)');
    }

    // 5. Return as string JSON (without spaces to facilitate copying to .env)
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
        console.log('\n🔑 Generating new Ed25519 key pair...\n');

        // Create DID and get the JWK and URI
        const did = await DidKey.create({ options: { algorithm: 'Ed25519' } });
        const portableDid = await did.export();

        if (!portableDid.privateKeys || portableDid.privateKeys.length === 0) {
            throw new Error('No private keys found in the exported DID');
        }

        const privateKeyJwk = portableDid.privateKeys[0];
        const privateKeyJwkString = JSON.stringify(privateKeyJwk);
        const didUri = portableDid.uri;

        console.log('✅ Key generated successfully!\n');
        console.log('📋 Copy this to your .env file:\n');
        console.log('─'.repeat(60));
        console.log(`PRIVATE_KEY_JWK='${privateKeyJwkString}'`);
        console.log('─'.repeat(60));
        console.log(`\n🔗 Associated DID: ${didUri}\n`);
        console.log('⚠️  IMPORTANT: Store this key securely. Do not share it publicly.\n');
    } catch (error) {
        console.error('❌ Error generating the key:', error.message);
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