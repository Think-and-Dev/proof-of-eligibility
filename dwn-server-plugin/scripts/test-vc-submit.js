

/**
 * Script de prueba para subir una Verifiable Credential al servidor DWN
 * Basado en los ejemplos oficiales de dwn-server
 * 
 * Uso:
 *   node scripts/test-vc-submit.js
 * 
 * Requisitos:
 *   - El servidor DWN debe estar corriendo (npm start)
 *   - Instalar dependencias: npm install @web5/dids @tbd54566975/dwn-sdk-js node-fetch uuid
 */

import { DidKey } from "@web5/dids"
import { RecordsWrite, RecordsRead } from '@tbd54566975/dwn-sdk-js';

import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// node.js 18 and earlier, needs globalThis.crypto polyfill. needed for dwn-sdk-js
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
    // @ts-ignore
    globalThis.crypto = webcrypto;
}

const DWN_SERVER_URL = process.env.DWN_SERVER_URL || 'http://localhost:3000';

async function main() {
    try {
        console.log('🚀 Iniciando prueba de VC submission...\n');

        // 1. Crear un did:key y su par de claves
        console.log('1️⃣ Generando did:key...');
        const did = await DidKey.create({ options: { algorithm: 'Ed25519' } });
        console.log(`   ✅ DID creado: ${did.uri}\n`);

        // 2. Crear una Verifiable Credential simple
        console.log('2️⃣ Creando Verifiable Credential...');
        const vc = {
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://www.w3.org/2018/credentials/examples/v1'
            ],
            type: ['VerifiableCredential', 'ProofOfEligibility'],
            issuer: did.uri,
            issuanceDate: new Date().toISOString(),
            credentialSubject: {
                id: did.uri,
                type: 'ProofOfEligibility',
                eligibility: true,
                timestamp: new Date().toISOString()
            }
        };
        const vcJson = JSON.stringify(vc);
        const vcBytes = new TextEncoder().encode(vcJson);
        console.log('   ✅ VC creada\n');

        // 3. Obtener el signer del DID y adaptarlo al formato que espera el SDK de DWN
        console.log('3️⃣ Preparando firma del mensaje...');
        const bearerDidSigner = await did.getSigner();

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

        // 4. Crear el mensaje RecordsWrite
        console.log('4️⃣ Creando mensaje RecordsWrite...');
        const recordsWrite = await RecordsWrite.create({
            data: vcBytes,
            dataFormat: 'application/json',
            schema: 'https://schema.org/VerifiableCredential',
            signer: signer,
        });
        console.log('   ✅ Mensaje RecordsWrite creado\n');

        // 5. Enviar el mensaje al servidor DWN usando dwn.processMessage
        console.log('5️⃣ Enviando VC al servidor DWN...');
        const jsonRpcRequest = {
            jsonrpc: '2.0',
            method: 'dwn.processMessage',
            params: {
                target: did.uri,
                message: recordsWrite.toJSON(),
            },
            id: uuidv4(),
        };
        console.log("executing request", jsonRpcRequest);

        const response = await fetch(DWN_SERVER_URL, {
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
        console.log(`   🔗 URL: ${DWN_SERVER_URL}\n`);

        // 6. Leer la VC de vuelta para verificar usando el recordId del mensaje creado
        console.log('6️⃣ Verificando lectura de la VC desde el servidor...');
        try {
            const recordsRead = await RecordsRead.create({
                filter: {
                    recordId: recordId,
                },
                signer: signer,
            });

            const readRequest = {
                jsonrpc: '2.0',
                method: 'dwn.processMessage',
                params: {
                    target: did.uri,
                    message: recordsRead.toJSON(),
                },
                id: uuidv4(),
            };

            const readResponse = await fetch(DWN_SERVER_URL, {
                method: 'POST',
                headers: {
                    'dwn-request': JSON.stringify(readRequest),
                },
            });

            if (!readResponse.ok) {
                throw new Error(`HTTP error! status: ${readResponse.status}`);
            }

            // Los datos pueden venir en el header dwn-response o en el body como stream
            const dwnResponseHeader = readResponse.headers.get('dwn-response');
            let readResult;

            if (dwnResponseHeader) {
                // Si hay header dwn-response, los datos vienen como stream en el body
                readResult = JSON.parse(dwnResponseHeader);

                console.log("got results from headers: ", readResult)

                // Leer el stream del body
                const streamData = await readResponse.arrayBuffer();
                const vcData = JSON.parse(Buffer.from(streamData).toString('utf-8'));

                console.log('   ✅ VC leída exitosamente desde el servidor:');
                console.log(JSON.stringify(vcData, null, 2));
            } else {
                // Si no hay header, la respuesta viene como JSON normal
                readResult = await readResponse.json();

                if (readResult.result?.reply?.entry?.data) {
                    const data = readResult.result.reply.entry.data;
                    let vcData;
                    if (typeof data === 'string') {
                        vcData = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));
                    } else {
                        vcData = JSON.parse(new TextDecoder().decode(data));
                    }
                    console.log('   ✅ VC leída exitosamente desde el servidor:');
                    console.log(JSON.stringify(vcData, null, 2));
                } else {
                    console.log('   ⚠️  La respuesta no contiene datos de la VC');
                    console.log('   📝 Respuesta:', JSON.stringify(readResult, null, 2));
                }
            }
        } catch (readError) {
            console.log(`   ⚠️  No se pudo leer la VC: ${readError.message}`);
            console.error(readError);
        }

        console.log('\n✅ Prueba completada exitosamente!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log(error);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
