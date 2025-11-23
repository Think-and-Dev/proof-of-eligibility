import type { BearerDid } from '@web5/dids';
import { PermissionGrant, RecordsWrite } from '@tbd54566975/dwn-sdk-js';

/**
 * Generates a UUID v4 compatible with browser environments
 * Uses crypto.randomUUID() if available, otherwise falls back to crypto.getRandomValues()
 * or a simple timestamp-based UUID if crypto is not available
 */
function generateUUID(): string {
    // Check if crypto.randomUUID is available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // This is not cryptographically secure but will work in any environment
    const timestamp = Date.now().toString(16);
    const randomPart1 = Math.random().toString(16).substring(2, 10);
    const randomPart2 = Math.random().toString(16).substring(2, 10);
    const randomPart3 = Math.random().toString(16).substring(2, 10);
    const randomPart4 = Math.random().toString(16).substring(2, 14);

    return `${timestamp.slice(-8)}-${randomPart1.slice(0, 4)}-4${randomPart2.slice(0, 3)}-${(Math.random() * 0x3f | 0x80).toString(16)}${randomPart3.slice(0, 3)}-${randomPart4}`;
}

/**
 * Creates a DID from a private key JWK
 * 
 * @param privateKeyJwk - The private key JWK as a JSON string or object
 * @returns Promise resolving to a BearerDid
 * @throws Error if the JWK is invalid or the DID cannot be created
 */
export async function createDidFromJwk(privateKeyJwk: string | object): Promise<BearerDid> {
    // Dynamic import to avoid SSR issues
    const { DidKey, DidKeyUtils } = await import('@web5/dids');

    let privateKeyJwkObj: any;
    let publicKeyJwkObj: any;

    try {
        // Parse the JWK
        const jwk = typeof privateKeyJwk === 'string' ? JSON.parse(privateKeyJwk) : privateKeyJwk;

        if (!jwk.kty || !jwk.crv || !jwk.d || !jwk.x) {
            throw new Error('JWK must contain kty, crv, x (public key) and d (private key)');
        }

        // Extract the public key (without 'd')
        publicKeyJwkObj = {
            kty: jwk.kty,
            crv: jwk.crv,
            x: jwk.x
        };

        privateKeyJwkObj = jwk;
    } catch (error: any) {
        throw new Error(`Error parsing JWK: ${error.message}`);
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

    return did;
}

/**
 * Options for granting access to a DID
 */
export interface GrantAccessOptions {
    scope?: {
        method?: string;
        schema?: string;
        protocol?: string;
        [key: string]: unknown;
    };
}

/**
 * Response from DWN server after processing a PermissionsGrant
 */
export interface GrantAccessResponse {
    jsonrpc: string;
    id: string;
    result?: {
        reply?: {
            status?: {
                code: number;
            };
        };
    };
    error?: {
        code: number;
        message: string;
    };
}

/**
 * Grants read access to a specific DID for your VCs
 * 
 * @param yourDid - Your DID (the owner of the VCs)
 * @param targetDidUri - The DID that should be granted access
 * @param options - Optional filters for the permission scope
 * @returns Promise resolving to the DWN server response
 * @throws Error if the grant request fails
 * 
 * @example
 * ```typescript
 * const did = await DidKey.create();
 * await grantAccessToDid(did, 'did:key:z6Mk...', {
 *   scope: {
 *     schema: 'https://schema.org/VerifiableCredential'
 *   }
 * });
 * ```
 */
export async function grantAccessToDid(
    yourDid: BearerDid,
    targetDidUri: string,
    options: GrantAccessOptions = {}
): Promise<GrantAccessResponse> {
    const DWN_SERVER_URL = process.env.NEXT_PUBLIC_DWN_SERVER_URL || 'http://localhost:3000';

    if (!yourDid?.uri) {
        throw new Error('A valid BearerDid object is required');
    }

    if (!targetDidUri || typeof targetDidUri !== 'string') {
        throw new Error('A valid target DID URI is required');
    }

    // Dynamic import to avoid SSR issues
    // const dwnSdk = await import('@tbd54566975/dwn-sdk-js');
    // console.log("dwnSdk: ", dwnSdk);
    // const PermissionGrant = (dwnSdk as any).PermissionGrant || (dwnSdk as any).PermissionsGrant;

    if (!PermissionGrant) {
        throw new Error('PermissionGrant not found in DWN SDK');
    }

    const signer = await yourDid.getSigner();

    // Adapt the signer to the format expected by DWN SDK
    const dwnSigner = {
        keyId: signer.keyId,
        algorithm: signer.algorithm,
        sign: async (content: Uint8Array): Promise<Uint8Array> => {
            return await signer.sign({ data: content });
        }
    };

    // Create the PermissionGrant
    const permissionsGrant = await PermissionGrant.create({
        dateCreated: Date.now(),
        grantedBy: yourDid.uri,
        grantedTo: targetDidUri,
        grantedFor: yourDid.uri,
        scope: {
            method: 'RecordsRead',
            ...options.scope // You can add schema, protocol, etc.
        },
        signer: dwnSigner,
    });

    // Generate a unique ID for the request
    const requestId = generateUUID();

    // Send to DWN server
    const grantRequest = {
        jsonrpc: '2.0' as const,
        method: 'dwn.processMessage' as const,
        params: {
            target: yourDid.uri,
            message: permissionsGrant.toJSON(),
        },
        id: requestId,
    };

    const response = await fetch(DWN_SERVER_URL, {
        method: 'POST',
        headers: {
            'dwn-request': JSON.stringify(grantRequest),
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to grant access: HTTP ${response.status} ${response.statusText}`);
    }

    const result: GrantAccessResponse = await response.json();

    if (result.error) {
        throw new Error(
            `Failed to grant access: ${result.error.message || JSON.stringify(result.error)}`
        );
    }

    console.log(`✅ Access granted to ${targetDidUri}`);
    return result;
}

export async function generateTrialFormVC(did: BearerDid, fhirPayload: any): Promise<any> {
    if (!did || !did.uri) {
        throw new Error('A valid BearerDid object is required');
    }

    const credentialSubjectId = did.uri;
    const credentialId = `urn:uuid:${generateUUID()}`;
    const expirationDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

    // 1. Create the VC structure without proof
    const vc = {
        '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://w3id.org/security/suites/ed25519-2020/v1'
        ],
        id: credentialId,
        type: ['VerifiableCredential', 'TrialForm'],
        issuer: did.uri,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
            id: credentialSubjectId,
            type: 'TrialForm',
            data: fhirPayload
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

export async function writeVCToDwn(vc: any, dwn: string, bearerDidSigner: any, targetDid: string) {
    // Adaptar el signer de @web5/dids al formato que espera @tbd54566975/dwn-sdk-js
    // El SDK de DWN espera: sign(content: Uint8Array) => Promise<Uint8Array>
    // Pero @web5/dids tiene: sign({ data: Uint8Array }) => Promise<Uint8Array>
    const signer = {
        keyId: bearerDidSigner.keyId,
        algorithm: bearerDidSigner.algorithm,
        sign: async (content: Uint8Array): Promise<Uint8Array> => {
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