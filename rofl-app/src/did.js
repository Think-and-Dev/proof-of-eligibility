const { DidKey, DidKeyUtils } = require('@web5/dids');
const crypto = require('crypto');


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

/**
 * Generates a signed Verifiable Credential (VC) for proof of eligibility.
 * 
 * Creates a VC with a valid proof signature using the provided DID's signer.
 * The VC follows the W3C Verifiable Credentials standard with Ed25519Signature2020 proof.
 * 
 * @param {BearerDid} did - The DID that will sign the VC (issuer)
 * @param {Object} options - Optional parameters for the VC
 * @param {string} options.credentialSubjectId - The DID or identifier of the credential subject (default: did.uri)
 * @param {Object} options.credentialSubject - Additional data for the credential subject
 * @param {string} options.credentialId - Unique identifier for the credential (default: auto-generated)
 * @param {string} options.expirationDate - ISO date string for credential expiration (optional)
 * 
 * @returns {Promise<Object>} A signed Verifiable Credential with proof
 * 
 * @example
 * ```javascript
 * const did = await getDid();
 * const vc = await generateEligibilityVC(did, {
 *   credentialSubjectId: 'did:example:patient123',
 *   credentialSubject: {
 *     eligibility: true,
 *     status: 'Approved'
 *   }
 * });
 * ```
 */
async function generateEligibilityVC(did, eligibility, options = {}) {
    if (!did || !did.uri) {
        throw new Error('A valid BearerDid object is required');
    }

    const {
        credentialSubjectId = did.uri,
        credentialSubject = {},
        credentialId = `urn:uuid:${crypto.randomUUID()}`,
        expirationDate
    } = options;

    // 1. Create the VC structure without proof
    const vc = {
        '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://w3id.org/security/suites/ed25519-2020/v1'
        ],
        id: credentialId,
        type: ['VerifiableCredential', 'ProofOfEligibility'],
        issuer: did.uri,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
            id: credentialSubjectId,
            type: 'ProofOfEligibility',
            data: {
                eligibility: eligibility,
            },
            ...credentialSubject
        }
    };

    // Add expiration date if provided
    if (expirationDate) {
        vc.expirationDate = expirationDate;
    }

    // 2. Get the signer from the DID
    const signer = await did.getSigner();

    // 3. Create a canonical representation of the VC for signing
    // For proper VC signing, we need to create a normalized representation
    // TODO: This is a simplified approach, we might want to use a proper JSON-LD canonicalization in the future
    const vcForSigning = JSON.parse(JSON.stringify(vc)); // Deep clone
    delete vcForSigning.proof; // Remove proof if it exists

    // Sort keys for consistent canonicalization
    const sortedVC = {};
    const keys = Object.keys(vcForSigning).sort();
    for (const key of keys) {
        sortedVC[key] = vcForSigning[key];
    }

    const canonicalVC = JSON.stringify(sortedVC);

    // 4. Sign the canonical VC
    const vcBytes = new TextEncoder().encode(canonicalVC);
    const signature = await signer.sign({ data: vcBytes });

    // 5. Convert signature to base64url for the proof
    const signatureBase64Url = Buffer.from(signature)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    // 6. Create the proof object
    const proof = {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        verificationMethod: signer.keyId,
        proofPurpose: 'assertionMethod',
        proofValue: signatureBase64Url
    };

    // 7. Add the proof to the VC
    vc.proof = proof;

    return vc;
}

module.exports = {
    getDid,
    generateEligibilityVC,
    generatePrivateKeyJwk,
    generateAndPrintPrivateKeyJwk
};