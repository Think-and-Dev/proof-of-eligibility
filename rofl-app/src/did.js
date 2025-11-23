const { DidKey, DidKeyUtils } = require('@web5/dids');
const crypto = require('crypto');
const { RecordsQuery, RecordsWrite } = require('@tbd54566975/dwn-sdk-js');


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
async function generateEligibilityVC(did, eligibility, targetDid, options = {}) {
    if (!did || !did.uri) {
        throw new Error('A valid BearerDid object is required');
    }

    const {
        credentialSubjectId = targetDid,
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
        recipient: targetDid,
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

/**
 * Gets the Verifiable Credentials (VCs) from a DWN item
 * 
 * This function queries the DWN for all VCs that were issued FOR a specific patient DID.
 * It filters VCs where credentialSubject.id matches the patient DID.
 * 
 * The function uses RecordsQuery with filters for:
 * - recipient: The DID that can read the records (works if VC was written with recipient: patientDid)
 * - schema: Filters for VerifiableCredential schema
 * - dataFormat: Ensures JSON format
 * 
 * Then it validates in code that credentialSubject.id === patientDid to ensure
 * the VC was issued FOR this specific patient (not just accessible by them).
 * 
 * @param {Object} item - The item object containing the dwn and did
 * @param {string} item.dwn - The DWN server URL
 * @param {string} item.did - The patient DID to query VCs for (must match credentialSubject.id)
 * @returns {Promise<Array>} An array of Verifiable Credentials (VCs) issued FOR this patient
 */
async function getDidVcsFromDwn(item) {
    const { dwn, did } = item;
    const vcs = [];

    try {
        const localDid = await getDid();
        const bearerDidSigner = await localDid.getSigner();
        const signer = {
            keyId: bearerDidSigner.keyId,
            algorithm: bearerDidSigner.algorithm,
            sign: async (content) => {
                return await bearerDidSigner.sign({ data: content });
            }
        };

        // Use RecordsQuery to get multiple VCs
        // Filter by:
        // - recipient: The DID that can read the records (VCs issued TO this DID)
        //   This works if the VC was written with recipient: patientDid
        //   If recipient is not set, we'll still get results and filter in code
        // - schema: Filter for VerifiableCredential schema
        // - dataFormat: Ensure JSON format
        // Note: We'll also filter by credentialSubject.id in code to ensure we get
        // only VCs issued FOR this specific patient DID (the subject of the credential)
        const recordsQuery = await RecordsQuery.create({
            filter: {
                recipient: did, // Filter by recipient if VCs were written with recipient: patientDid
                schema: 'https://schema.org/VerifiableCredential',
                dataFormat: 'application/json',
            },
            signer: signer,
        });

        console.log("recordsQuery: ", recordsQuery.toJSON());

        const queryRequest = {
            jsonrpc: '2.0',
            method: 'dwn.processMessage',
            params: {
                target: did,
                message: recordsQuery.toJSON(),
            },
            id: crypto.randomUUID(),
        };

        console.log("queryRequest: ", queryRequest);

        const queryResponse = await fetch(dwn, {
            method: 'POST',
            headers: {
                'dwn-request': JSON.stringify(queryRequest),
            },
        });

        console.log("queryResponse status: ", queryResponse.status);

        if (!queryResponse.ok) {
            throw new Error(`HTTP error! status: ${queryResponse.status}`);
        }

        const queryResult = await queryResponse.json();

        if (queryResult.error) {
            throw new Error(`DWN error: ${queryResult.error.message || JSON.stringify(queryResult.error)}`);
        }

        // RecordsQuery returns entries array
        const entries = queryResult.result?.reply?.entries || [];

        console.log(`   ✅ Found ${entries.length} VC record(s)`);

        // Process each entry to extract the VC data
        for (const entry of entries) {
            try {
                let vcData = null;

                // Check if data is encoded in the entry
                if (entry.encodedData) {
                    // Data is already encoded in the entry
                    vcData = JSON.parse(Buffer.from(entry.encodedData, 'base64').toString('utf-8'));
                } else if (entry.recordsWrite?.descriptor?.dataCid) {
                    // Data needs to be fetched separately (for larger records)
                    // For now, we'll need to make a RecordsRead for this specific recordId
                    console.log(`   ⚠️  Record ${entry.recordId} has data stored separately, skipping for now`);
                    continue;
                }

                if (vcData) {
                    // Filter by credentialSubject.id to ensure this VC was issued FOR this patient
                    // This is the DID of the patient (the subject of the credential)
                    const credentialSubjectId = vcData.credentialSubject?.id;

                    if (credentialSubjectId === did) {
                        console.log(`   ✅ VC parsed and verified for patient: ${vcData.id || 'no-id'}`);
                        vcs.push(vcData);
                    } else {
                        console.log(`   ⚠️  VC skipped - credentialSubject.id (${credentialSubjectId}) does not match patient DID (${did})`);
                    }
                }
            } catch (parseError) {
                console.error(`   ⚠️  Error parsing VC from entry: ${parseError.message}`);
            }
        }

        console.log(`   ✅ Total VCs retrieved: ${vcs.length}`);
        return vcs;

    } catch (error) {
        console.error(`   ❌ Error querying VCs from DWN: ${error.message}`);
        console.error(error);
        throw error;
    }
}

/**
 * Validates a Verifiable Credential (VC) and extracts the FHIR payload
 * @param {Object} vc - The Verifiable Credential to validate
 * @returns {Object} - The FHIR payload from credentialSubject.data
 * @throws {Error} - If the VC is invalid
 */
async function validateAndExtractVC(vc) {
    // 1. Validate VC structure
    if (!vc || typeof vc !== 'object') {
        throw new Error('VC must be a valid object');
    }

    if (!vc['@context'] || !Array.isArray(vc['@context'])) {
        throw new Error('VC must have @context array');
    }

    if (!vc.type || !Array.isArray(vc.type) || !vc.type.includes('VerifiableCredential')) {
        throw new Error('VC must have type array containing VerifiableCredential');
    }

    if (!vc.issuer || typeof vc.issuer !== 'string') {
        throw new Error('VC must have a valid issuer DID');
    }

    if (!vc.credentialSubject || typeof vc.credentialSubject !== 'object') {
        throw new Error('VC must have a valid credentialSubject');
    }

    if (!vc.proof || typeof vc.proof !== 'object') {
        throw new Error('VC must have a proof object');
    }

    // 2. Verify the signature
    // Resolve the issuer DID to get the public key
    const issuerDid = vc.issuer;
    const resolutionResult = await DidKey.resolve(issuerDid);

    if (!resolutionResult.didDocument) {
        throw new Error(`Could not resolve issuer DID: ${issuerDid}`);
    }

    // Get the verification method from the proof
    const proof = vc.proof;
    const verificationMethod = proof.verificationMethod;

    if (!verificationMethod) {
        throw new Error('Proof must have verificationMethod');
    }

    // Find the verification method in the DID document
    const verificationMethods = resolutionResult.didDocument.verificationMethod || [];
    const vm = verificationMethods.find(vm => vm.id === verificationMethod || vm.id.endsWith(verificationMethod.split('#')[1]));

    if (!vm) {
        throw new Error(`Verification method ${verificationMethod} not found in DID document`);
    }

    // 3. Verify the signature
    // Recreate the canonical VC (without proof) for verification
    const vcForVerification = JSON.parse(JSON.stringify(vc));
    delete vcForVerification.proof;

    // Sort keys for consistent canonicalization (same as in generation)
    const sortedVC = {};
    const keys = Object.keys(vcForVerification).sort();
    for (const key of keys) {
        sortedVC[key] = vcForVerification[key];
    }

    const canonicalVC = JSON.stringify(sortedVC);
    const vcBytes = Buffer.from(canonicalVC, 'utf8');

    // Decode the signature from base64url
    const signatureBase64Url = proof.proofValue;
    const signature = Buffer.from(
        signatureBase64Url.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
    );

    // Get the public key from the verification method
    const publicKeyJwk = vm.publicKeyJwk;
    if (!publicKeyJwk || publicKeyJwk.crv !== 'Ed25519') {
        throw new Error('Unsupported key type. Only Ed25519 is supported.');
    }

    // Import the public key and verify using Web Crypto API (available in Node.js 15+)
    const publicKeyBytes = Buffer.from(publicKeyJwk.x, 'base64url');

    // Use Web Crypto API for Ed25519 verification
    const webCrypto = crypto.webcrypto || require('crypto').webcrypto;
    if (!webCrypto) {
        throw new Error('Web Crypto API not available. Node.js 15+ required.');
    }

    const cryptoKey = await webCrypto.subtle.importKey(
        'raw',
        publicKeyBytes,
        { name: 'Ed25519' },
        false,
        ['verify']
    );

    const isValid = await webCrypto.subtle.verify(
        'Ed25519',
        cryptoKey,
        signature,
        vcBytes
    );

    if (!isValid) {
        throw new Error('VC signature verification failed');
    }

    // 4. Extract FHIR payload from credentialSubject.data
    if (!vc.credentialSubject.data) {
        throw new Error('VC credentialSubject must have data field containing FHIR payload');
    }

    const fhirPayload = vc.credentialSubject.data;

    // Validate that it looks like a FHIR QuestionnaireResponse
    if (!fhirPayload || typeof fhirPayload !== 'object') {
        throw new Error('FHIR payload must be a valid object');
    }

    if (fhirPayload.resourceType !== 'QuestionnaireResponse') {
        throw new Error('FHIR payload must be a QuestionnaireResponse');
    }

    console.log('✅ VC validated successfully');
    console.log('✅ FHIR payload extracted:', fhirPayload.resourceType);

    return { fhirPayload, vc };
}

async function writeVCToDwn(vc, dwn, bearerDidSigner, targetDid) {
    // Adaptar el signer de @web5/dids al formato que espera @tbd54566975/dwn-sdk-js
    // El SDK de DWN espera: sign(content: Uint8Array) => Promise<Uint8Array>
    // Pero @web5/dids tiene: sign({ data: Uint8Array }) => Promise<Uint8Array>
    const signer = {
        keyId: bearerDidSigner.keyId,
        algorithm: bearerDidSigner.algorithm,
        sign: async (content) => {
            return await bearerDidSigner.sign({ data: content });
        }
    };
    console.log('   ✅ Signer obtenido y adaptado\n');

    const vcJson = JSON.stringify(vc);
    const vcBytes = new TextEncoder().encode(vcJson);

    // 4. Crear el mensaje RecordsWrite
    console.log('4️⃣ Creando mensaje RecordsWrite...');
    const recordsWrite = await RecordsWrite.create({
        data: vcBytes,
        dataFormat: 'application/json',
        schema: 'https://schema.org/VerifiableCredential',
        signer: signer,
        recipient: targetDid,
    });
    console.log('   ✅ Mensaje RecordsWrite creado\n');

    // 5. Enviar el mensaje al servidor DWN usando dwn.processMessage
    console.log('5️⃣ Enviando VC al servidor DWN...');
    const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'dwn.processMessage',
        params: {
            target: targetDid,
            message: recordsWrite.toJSON(),
        },
        id: crypto.randomUUID(),
    };
    console.log("executing request", jsonRpcRequest);

    const response = await fetch(dwn, {
        method: 'POST',
        headers: {
            'dwn-request': JSON.stringify(jsonRpcRequest),
            'content-type': 'application/octet-stream',
        },
        body: Buffer.from(vcBytes),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
        throw new Error(`JSON-RPC error: ${result.error.message || JSON.stringify(result.error)}`);
    }

    console.log(`   ✅ VC escrita exitosamente!`);
    console.log(`   📝 Status: ${result.result?.reply?.status?.code || 'N/A'}`);
    const recordId = recordsWrite.message.recordId;
    console.log(`   📝 Record ID: ${recordId}`);
    console.log(`   🔗 URL: ${dwn}\n`);
}

module.exports = {
    getDid,
    generateEligibilityVC,
    generatePrivateKeyJwk,
    generateAndPrintPrivateKeyJwk,
    getDidVcsFromDwn,
    validateAndExtractVC,
    writeVCToDwn
};