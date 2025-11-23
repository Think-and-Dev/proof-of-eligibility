import { Synapse, RPC_URLS } from "@filoz/synapse-sdk";
import pkg from '@lit-protocol/lit-node-client-nodejs';
const { LitNodeClientNodeJs } = pkg;
import { generateAuthSig } from '@lit-protocol/auth-helpers';
import { createSiweMessage } from '@lit-protocol/auth-helpers';
import { IndexLevel } from "@tbd54566975/dwn-sdk-js";
import { BlockstoreLevel } from "@tbd54566975/dwn-sdk-js";
import { createLevelDatabase } from "@tbd54566975/dwn-sdk-js";
import { MessageStoreLevel } from "@tbd54566975/dwn-sdk-js";
import { Readable } from "readable-stream";
import { CID } from "multiformats/cid";
import * as block from "multiformats/block";
import * as cbor from "@ipld/dag-cbor";
import { sha256 } from "multiformats/hashes/sha2";
import { Message } from "@tbd54566975/dwn-sdk-js";
import { executeUnlessAborted } from "@tbd54566975/dwn-sdk-js";
import { ethers } from "ethers";

/**
 * Shared base class for handling connection and operations with Filecoin
 * Uses Lit Protocol for decentralized encryption/decryption
 */
class FilecoinStorage {
    constructor() {
        this.synapse = null;
        this.initialized = false;
        this.metadataStore = null; // Small LevelDB only for mapping CIDs -> Piece CIDs
        this.litClient = null;
        this.litInitialized = false;
        this.serverPrivateKey = process.env.DWN_SERVER_PRIVATE_KEY;
        // Normalize address to checksummed format (EIP-55) if provided
        this.serverAddress = process.env.DWN_SERVER_ADDRESS
            ? ethers.getAddress(process.env.DWN_SERVER_ADDRESS)
            : undefined;
        this.wallet = null; // Ethers wallet for signing
    }

    /**
     * Get authorized servers list
     * Currently reads from environment variable
     * 
     * TODO: In the future, this could read from a smart contract for decentralized management
     * For the hackathon, we'll use environment variable for simplicity
     * 
     * Example future implementation:
     * - Read from smart contract: await contract.getAuthorizedServers()
     * - Or from centralized API: await fetch('/api/servers')
     * - Or from IPFS/config file: await ipfs.get('/config/servers.json')
     */
    getAuthorizedServers() {
        const serversEnv = process.env.DWN_AUTHORIZED_SERVERS;
        if (serversEnv) {
            return serversEnv.split(',').map(addr => addr.trim());
        }

        // Fallback: only this server
        if (this.serverAddress) {
            return [this.serverAddress];
        }

        throw new Error("DWN_SERVER_ADDRESS or DWN_AUTHORIZED_SERVERS must be configured");
    }

    /**
     * Build access control conditions for Lit Protocol
     */
    buildAccessControlConditions() {
        const authorizedServers = this.getAuthorizedServers();

        if (authorizedServers.length === 1) {
            // Single server: simple equality check
            return [
                {
                    contractAddress: '',
                    standardContractType: '',
                    chain: 'ethereum',
                    method: '',
                    parameters: [':userAddress'],
                    returnValueTest: {
                        comparator: '=',
                        value: authorizedServers[0],
                    },
                },
            ];
        }

        // Multiple servers: OR condition (any of them can decrypt)
        return [
            {
                contractAddress: '',
                standardContractType: '',
                chain: 'ethereum',
                method: '',
                parameters: [':userAddress'],
                returnValueTest: {
                    comparator: 'in',
                    value: authorizedServers,
                },
            },
        ];
    }

    /**
     * Initialize Lit Protocol client
     */
    async initializeLit() {
        if (this.litInitialized) {
            return;
        }

        if (!this.serverPrivateKey) {
            throw new Error(
                "DWN_SERVER_PRIVATE_KEY is not configured. " +
                "Set it in your .env file or as an environment variable."
            );
        }

        try {
            // Initialize Lit client
            this.litClient = new LitNodeClientNodeJs({
                litNetwork: process.env.LIT_NETWORK,
                debug: process.env.LIT_DEBUG === 'true' || false,
            });

            await this.litClient.connect();
            this.litInitialized = true;
            console.log("[FilecoinStorage] ✅ Lit Protocol client connected");

            // Initialize wallet for authentication
            this.wallet = new ethers.Wallet(this.serverPrivateKey);
            if (!this.serverAddress) {
                const address = await this.wallet.getAddress();
                // Convert to checksummed address (EIP-55) - required by SIWE
                this.serverAddress = ethers.getAddress(address);
            } else {
                // Ensure existing address is checksummed
                this.serverAddress = ethers.getAddress(this.serverAddress);
            }
        } catch (error) {
            console.error("[FilecoinStorage] ❌ Error initializing Lit Protocol:", error.message);
            throw error;
        }
    }

    /**
     * Get authentication signature for Lit Protocol
     * Server authenticates with its own wallet using SIWE (Sign-In With Ethereum)
     * Uses getWalletSig to ensure proper chain information is included
     */
    async getAuthSignature() {
        if (!this.wallet || !this.litClient) {
            await this.initializeLit();
        }

        // Ensure serverAddress is set (get from wallet if not set)
        // Use checksummed address (EIP-55) for SIWE compatibility
        if (!this.serverAddress) {
            if (!this.wallet) {
                await this.initializeLit();
            }
            const address = await this.wallet.getAddress();
            // Convert to checksummed address (EIP-55) - required by SIWE
            this.serverAddress = ethers.getAddress(address);
        } else {
            // Ensure existing address is checksummed
            this.serverAddress = ethers.getAddress(this.serverAddress);
        }

        // Use getWalletSig which properly handles chain information
        // This ensures Lit can extract the chain from the authSig
        const authSig = await this.litClient.getWalletSig({
            chain: 'ethereum', // Ethereum mainnet
            authNeededCallback: async (params) => {
                // Get nonce from params or Lit node
                const nonce = params.nonce || await this.litClient.getLatestBlockhash();

                // Create SIWE message
                const siweMessage = await createSiweMessage({
                    domain: params.domain || 'dwn-server',
                    walletAddress: this.serverAddress,
                    statement: params.statement || 'DWN Server authentication for Lit Protocol',
                    uri: params.uri || `https://dwn-server`,
                    version: '1',
                    chainId: 1, // Ethereum mainnet
                    nonce,
                    expiration: params.expiration || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
                });

                // Generate authSig using the SIWE message
                return await generateAuthSig({
                    signer: this.wallet,
                    toSign: siweMessage,
                    address: this.serverAddress,
                });
            },
        });

        return authSig;
    }

    /**
     * Initializes the connection to Filecoin Cloud
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        const privateKey = process.env.FILECOIN_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error(
                "FILECOIN_PRIVATE_KEY is not configured. " +
                "Set it in your .env file or as an environment variable."
            );
        }

        const rpcURL = process.env.FILECOIN_RPC_URL || RPC_URLS.calibration.http;

        console.log("[FilecoinStorage] 🔄 Connecting to Filecoin Cloud...");
        this.synapse = await Synapse.create({
            privateKey,
            rpcURL,
        });
        console.log("[FilecoinStorage] ✅ Connected to Filecoin Cloud");

        // Initialize small metadata store only for mapping CIDs -> Piece CIDs
        this.metadataStore = new BlockstoreLevel({
            location: "filecoin-store/metadata",
            createLevelDatabase,
        });
        await this.metadataStore.open();

        // Initialize Lit Protocol
        await this.initializeLit();

        this.initialized = true;
    }

    /**
     * Encrypts data using Lit Protocol before uploading to Filecoin
     * 
     * This is the simple approach: encrypt everything directly with Lit.
     * 
     * TODO: For production with large data, consider implementing a hybrid approach:
     * - Encrypt data with AES (fast, efficient)
     * - Encrypt the AES key with Lit (decentralized key management)
     * - This would improve performance for large VCs or bulk operations
     * 
     * @param {Uint8Array} data - The data to encrypt
     * @returns {Promise<{encryptedData: Uint8Array, accessControlConditions: string}>}
     */
    async encryptData(data) {
        await this.initializeLit();

        // Get access control conditions
        const accessControlConditions = this.buildAccessControlConditions();

        try {
            // Encrypt data directly with Lit Protocol
            // Lit handles key management internally using MPC TSS
            console.log(`[FilecoinStorage] 🔐 Encrypting ${data.length} bytes with Lit Protocol...`);
            const { ciphertext, dataToEncryptHash } = await this.litClient.encrypt({
                accessControlConditions,
                dataToEncrypt: data, // Uint8Array directly
            });

            console.log(`[FilecoinStorage] ✅ Data encrypted: ${ciphertext.length} characters (base64)`);

            // ciphertext is base64-encoded string, convert to Uint8Array for Filecoin storage
            const encryptedData = Uint8Array.from(Buffer.from(ciphertext, 'base64'));

            return {
                encryptedData, // Uint8Array for Filecoin (ciphertext converted from base64)
                dataToEncryptHash, // Required for decryption
                accessControlConditions: JSON.stringify(accessControlConditions),
            };
        } catch (error) {
            console.error("[FilecoinStorage] ❌ Error encrypting with Lit Protocol:", error.message);
            throw error;
        }
    }

    /**
     * Decrypts data using Lit Protocol after downloading from Filecoin
     * 
     * @param {Uint8Array} encryptedData - The encrypted data to decrypt
     * @param {string} accessControlConditions - The access control conditions (JSON string)
     * @returns {Promise<Uint8Array>} - The decrypted data
     */
    async decryptData(encryptedData, dataToEncryptHash, accessControlConditions) {
        await this.initializeLit();

        try {
            // Authenticate with server wallet
            const authSig = await this.getAuthSignature();

            // Parse access control conditions
            const conditions = JSON.parse(accessControlConditions);

            // Convert Uint8Array (from Filecoin) back to base64 string for Lit decrypt
            // Lit decrypt() expects ciphertext as base64 string
            const ciphertextBase64 = Buffer.from(encryptedData).toString('base64');

            // Decrypt data with Lit Protocol
            // Lit verifies that this server meets the access control conditions
            console.log(`[FilecoinStorage] 🔓 Decrypting ${ciphertextBase64.length} characters with Lit Protocol...`);
            const { decryptedData } = await this.litClient.decrypt({
                ciphertext: ciphertextBase64, // base64 string (converted from Uint8Array)
                dataToEncryptHash, // From encrypt result
                accessControlConditions: conditions,
                authSig, // Server authentication
                chain: 'ethereum', // Explicitly specify chain (Ethereum mainnet)
            });

            console.log(`[FilecoinStorage] ✅ Data decrypted: ${decryptedData.length} bytes`);

            return decryptedData; // Already Uint8Array
        } catch (error) {
            console.error("[FilecoinStorage] ❌ Error decrypting with Lit Protocol:", error.message);
            throw error;
        }
    }

    /**
     * Uploads data to Filecoin and returns the Piece CID
     * Data is encrypted before upload using Lit Protocol
     */
    async uploadToFilecoin(data) {
        await this.initialize();

        if (Buffer.isBuffer(data)) {
            data = new Uint8Array(data);
        } else if (data instanceof Uint8Array) {
            // Already in the correct format
        } else {
            // Convert to Uint8Array
            data = new TextEncoder().encode(JSON.stringify(data));
        }

        // Encrypt data with Lit Protocol before uploading
        const { encryptedData, dataToEncryptHash, accessControlConditions } = await this.encryptData(data);

        // Filecoin SDK expects Uint8Array or ReadableStream
        // encryptedData is already Uint8Array (ciphertext converted from base64)
        // Create a ReadableStream from the Uint8Array to ensure compatibility
        const uploadStream = new ReadableStream({
            start(controller) {
                controller.enqueue(encryptedData);
                controller.close();
            }
        });

        console.log(`[FilecoinStorage] ☁️  Uploading ${encryptedData.length} bytes to Filecoin...`);
        const { pieceCid, size } = await this.synapse.storage.upload(uploadStream);

        // Convert pieceCid to string (it comes as CID object from Filecoin SDK)
        // Handle both string and CID object formats
        let pieceCidString;
        if (typeof pieceCid === 'string') {
            pieceCidString = pieceCid;
        } else if (pieceCid && typeof pieceCid.toString === 'function') {
            pieceCidString = pieceCid.toString();
        } else if (pieceCid && pieceCid['/']) {
            // Handle multiformats CID format: { '/': 'bafy...' }
            pieceCidString = pieceCid['/'];
        } else {
            pieceCidString = String(pieceCid);
        }
        console.log(`[FilecoinStorage] ✅ Data uploaded. Piece CID: ${pieceCidString}`);

        // Return Piece CID, hash, and access control conditions (needed for decryption)
        // The ciphertext is stored in Filecoin, we don't need to store it locally
        return {
            pieceCid: pieceCidString, // Store as string
            size,
            dataToEncryptHash, // Required for decryption
            accessControlConditions, // Required for decryption
        };
    }

    /**
     * Downloads data from Filecoin using the Piece CID
     * Data is decrypted after download using Lit Protocol
     */
    async downloadFromFilecoin(pieceCid, dataToEncryptHash, accessControlConditions) {
        await this.initialize();

        console.log(`[FilecoinStorage] 📥 Downloading from Filecoin: ${pieceCid}...`);
        const encryptedData = await this.synapse.storage.download(pieceCid);
        console.log(`[FilecoinStorage] ✅ Data downloaded: ${encryptedData.length} bytes`);

        // Decrypt data with Lit Protocol after downloading
        // encryptedData is Uint8Array from Filecoin, will be converted to base64 inside decryptData()
        const data = await this.decryptData(encryptedData, dataToEncryptHash, accessControlConditions);

        return data;
    }

    /**
     * Saves the mapping CID -> Piece CID and access control conditions in the metadata store
     */
    async saveMapping(cidString, pieceCid, dataToEncryptHash, accessControlConditions) {
        if (!this.metadataStore) {
            await this.initialize();
        }

        const cid = CID.parse(cidString);
        const partition = await this.metadataStore.partition("mappings");

        // Store mapping with Lit metadata
        // Note: ciphertext is stored in Filecoin, we only store the pieceCid and decryption metadata
        const mappingData = {
            pieceCid, // To download ciphertext from Filecoin
            dataToEncryptHash, // Required for decryption
            accessControlConditions, // Required for decryption
        };

        const mappingBytes = new TextEncoder().encode(JSON.stringify(mappingData));
        await partition.put(cid, mappingBytes);
    }

    /**
     * Gets the Piece CID and access control conditions associated with a local CID
     */
    async getMapping(cidString) {
        if (!this.metadataStore) {
            await this.initialize();
        }

        const cid = CID.parse(cidString);
        const partition = await this.metadataStore.partition("mappings");
        const mappingBytes = await partition.get(cid);

        if (!mappingBytes) {
            return null;
        }

        // Return mapping with access control conditions
        const mappingData = JSON.parse(new TextDecoder().decode(mappingBytes));

        // Ensure pieceCid is a string (it might have been saved as object in old format)
        if (mappingData.pieceCid && typeof mappingData.pieceCid !== 'string') {
            if (mappingData.pieceCid['/']) {
                // Handle multiformats CID format: { '/': 'bafy...' }
                mappingData.pieceCid = mappingData.pieceCid['/'];
            } else if (typeof mappingData.pieceCid.toString === 'function') {
                mappingData.pieceCid = mappingData.pieceCid.toString();
            } else {
                mappingData.pieceCid = String(mappingData.pieceCid);
            }
        }

        return mappingData;
        // Returns: {
        //   pieceCid: "...", (always a string)
        //   dataToEncryptHash: "...",
        //   accessControlConditions: "[...]"
        // }
    }

    /**
     * Closes the connections
     */
    async close() {
        if (this.metadataStore) {
            await this.metadataStore.close();
        }
        if (this.litClient) {
            // Lit client doesn't have explicit close, but we can mark as uninitialized
            this.litInitialized = false;
        }
        this.initialized = false;
    }
}

// Shared instance of FilecoinStorage
const filecoinStorage = new FilecoinStorage();

/**
 * MessageStore that stores messages in Filecoin
 * Uses LevelDB ONLY for indexes (required for queries) and metadata (mappings)
 * Actual data is stored in Filecoin and encrypted with Lit Protocol
 */
export class FilecoinMessageStore {
    constructor() {
        // We use IndexLevel only for indexes (required for queries)
        this.index = new IndexLevel({
            location: "filecoin-store/message-index",
            createLevelDatabase,
        });
        console.log("[FilecoinMessageStore] ✅ Plugin loaded and instantiated");
    }

    async open() {
        await this.index.open();
        await filecoinStorage.initialize();
    }

    async close() {
        await this.index.close();
        await filecoinStorage.close();
    }

    async put(tenant, message, indexes, options) {
        options?.signal?.throwIfAborted();

        // Calculate the message CID
        const messageCid = await Message.getCid(message);
        const messageCidString = messageCid.toString();

        // Encode the message
        const encodedMessageBlock = await executeUnlessAborted(
            block.encode({ value: message, codec: cbor, hasher: sha256 }),
            options?.signal
        );

        // Upload the message to Filecoin (encrypted with Lit)
        try {
            const { pieceCid, dataToEncryptHash, accessControlConditions } = await filecoinStorage.uploadToFilecoin(
                encodedMessageBlock.bytes
            );

            // Save the mapping CID -> Piece CID with Lit metadata
            // ciphertext is stored in Filecoin, we only store pieceCid and decryption metadata
            await filecoinStorage.saveMapping(
                messageCidString,
                pieceCid,
                dataToEncryptHash,
                accessControlConditions
            );

            console.log(
                `[FilecoinMessageStore] 💾 Message ${messageCidString} saved to Filecoin: ${pieceCid}`
            );
        } catch (error) {
            console.error(
                `[FilecoinMessageStore] ❌ Error uploading message to Filecoin:`,
                error.message
            );
            throw error;
        }

        // Save indexes in LevelDB (required for queries)
        await this.index.put(tenant, messageCidString, indexes, options);
    }

    async get(tenant, cidString, options) {
        options?.signal?.throwIfAborted();

        // Get the mapping with access control conditions
        const mapping = await filecoinStorage.getMapping(cidString);
        console.log(mapping);

        if (!mapping) {
            return undefined;
        }

        try {
            // Download and decrypt from Filecoin using Lit Protocol
            console.log(
                `[FilecoinMessageStore] 📥 Retrieving message from Filecoin: ${mapping.pieceCid}`
            );
            const data = await filecoinStorage.downloadFromFilecoin(
                mapping.pieceCid,
                mapping.dataToEncryptHash,
                mapping.accessControlConditions
            );

            // Decode the message from bytes
            const decodedBlock = await executeUnlessAborted(
                block.decode({ bytes: data, codec: cbor, hasher: sha256 }),
                options?.signal
            );

            return decodedBlock.value;
        } catch (error) {
            console.error(
                `[FilecoinMessageStore] ❌ Error retrieving from Filecoin:`,
                error.message
            );
            return undefined;
        }
    }

    async query(tenant, filters, messageSort, pagination, options) {
        options?.signal?.throwIfAborted();

        // Use IndexLevel to perform the query (required for filters, sorting, pagination)
        const queryOptions = MessageStoreLevel.buildQueryOptions(messageSort, pagination);
        const results = await this.index.query(tenant, filters, queryOptions, options);

        let cursor;
        // Check if there are more results
        if (pagination?.limit !== undefined && pagination.limit < results.length) {
            results.splice(-1);
            cursor = IndexLevel.createCursorFromLastArrayItem(
                results,
                queryOptions.sortProperty
            );
        }

        // Get messages from Filecoin using the found CIDs
        const messages = [];
        for (let i = 0; i < results.length; i++) {
            const { messageCid } = results[i];
            const message = await this.get(tenant, messageCid, options);
            if (message) {
                messages.push(message);
            }
        }

        return { messages, cursor };
    }

    async delete(tenant, cidString, options) {
        options?.signal?.throwIfAborted();

        // Delete from index
        await this.index.delete(tenant, cidString, options);

        // Note: We don't delete from Filecoin as it is immutable
        // We only delete the local mapping if necessary
        console.log(
            `[FilecoinMessageStore] 🗑️  Message ${cidString} deleted from index (Filecoin is immutable)`
        );
    }

    async clear() {
        await this.index.clear();
        // Note: We cannot clear Filecoin as it is immutable
        console.log(
            `[FilecoinMessageStore] 🗑️  Indexes cleared (Filecoin is immutable)`
        );
    }
}

/**
 * DataStore that stores data in Filecoin
 * Data is encrypted with Lit Protocol
 */
export class FilecoinDataStore {
    constructor() {
        // We only use a small metadata store for mappings
        this.metadataStore = new BlockstoreLevel({
            location: "filecoin-store/data-metadata",
            createLevelDatabase,
        });
        console.log("[FilecoinDataStore] ✅ Plugin loaded and instantiated");
    }

    async open() {
        await this.metadataStore.open();
        await filecoinStorage.initialize();
    }

    async close() {
        await this.metadataStore.close();
        await filecoinStorage.close();
    }

    async put(tenant, recordId, dataCid, dataStream) {
        // Read the complete stream
        const chunks = [];
        for await (const chunk of dataStream) {
            chunks.push(chunk);
        }
        const data = Buffer.concat(chunks);
        const dataSize = data.length;

        // Upload to Filecoin (encrypted with Lit)
        try {
            const { pieceCid, dataToEncryptHash, accessControlConditions } = await filecoinStorage.uploadToFilecoin(data);

            // Save the mapping dataCid -> pieceCid with Lit metadata
            // ciphertext is stored in Filecoin, we only store pieceCid and decryption metadata
            await filecoinStorage.saveMapping(dataCid, pieceCid, dataToEncryptHash, accessControlConditions);

            console.log(
                `[FilecoinDataStore] 💾 Data ${dataCid} saved to Filecoin: ${pieceCid}`
            );
        } catch (error) {
            console.error(
                `[FilecoinDataStore] ❌ Error uploading data to Filecoin:`,
                error.message
            );
            throw error;
        }

        return { dataSize };
    }

    async get(tenant, recordId, dataCid) {
        // Get the mapping with access control conditions
        const mapping = await filecoinStorage.getMapping(dataCid);

        if (!mapping) {
            return undefined;
        }

        try {
            // Download and decrypt from Filecoin using Lit Protocol
            console.log(
                `[FilecoinDataStore] 📥 Retrieving data from Filecoin: ${mapping.pieceCid}`
            );
            const data = await filecoinStorage.downloadFromFilecoin(
                mapping.pieceCid,
                mapping.dataToEncryptHash,
                mapping.accessControlConditions
            );

            // Create a stream from the data
            const dataStream = new Readable({
                read() {
                    this.push(data);
                    this.push(null); // End stream
                },
            });

            return {
                dataSize: data.length,
                dataStream,
            };
        } catch (error) {
            console.error(
                `[FilecoinDataStore] ❌ Error retrieving from Filecoin:`,
                error.message
            );
            return undefined;
        }
    }

    async delete(tenant, recordId, dataCid) {
        // Note: We don't delete from Filecoin as it is immutable
        // We only delete the local mapping if necessary
        const cid = CID.parse(dataCid);
        const partition = await this.metadataStore.partition("mappings");
        await partition.delete(cid);
        console.log(
            `[FilecoinDataStore] 🗑️  Data ${dataCid} deleted from metadata (Filecoin is immutable)`
        );
    }

    async clear() {
        await this.metadataStore.clear();
        // Note: We cannot clear Filecoin as it is immutable
        console.log(
            `[FilecoinDataStore] 🗑️  Metadata cleared (Filecoin is immutable)`
        );
    }
}
