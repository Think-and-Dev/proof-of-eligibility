import { Synapse, RPC_URLS } from "@filoz/synapse-sdk";
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

/**
 * Shared base class for handling connection and operations with Filecoin
 */
class FilecoinStorage {
    constructor() {
        this.synapse = null;
        this.initialized = false;
        this.metadataStore = null; // Small LevelDB only for mapping CIDs -> Piece CIDs
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

        this.initialized = true;
    }

    /**
     * Encrypts data before uploading to Filecoin
     * Override this method to implement your encryption logic
     * @param {Uint8Array} data - The data to encrypt
     * @returns {Promise<Uint8Array>} - The encrypted data
     */
    async encryptData(data) {
        // TODO: Implement your encryption logic here
        // For now, returns data as-is (no encryption)
        // Example implementation:
        // - Use AES-GCM with a key derived from environment variables
        // - Use Web Crypto API for encryption
        // - Return encrypted data as Uint8Array
        return data;
    }

    /**
     * Decrypts data after downloading from Filecoin
     * Override this method to implement your decryption logic
     * @param {Uint8Array} encryptedData - The encrypted data to decrypt
     * @returns {Promise<Uint8Array>} - The decrypted data
     */
    async decryptData(encryptedData) {
        // TODO: Implement your decryption logic here
        // For now, returns data as-is (no decryption)
        // Example implementation:
        // - Use AES-GCM with the same key used for encryption
        // - Use Web Crypto API for decryption
        // - Return decrypted data as Uint8Array
        return encryptedData;
    }

    /**
     * Uploads data to Filecoin and returns the Piece CID
     * Data is encrypted before upload
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

        // Encrypt data before uploading
        console.log(`[FilecoinStorage] 🔐 Encrypting ${data.length} bytes...`);
        const encryptedData = await this.encryptData(data);
        console.log(`[FilecoinStorage] ✅ Data encrypted: ${encryptedData.length} bytes`);

        console.log(`[FilecoinStorage] ☁️  Uploading ${encryptedData.length} bytes to Filecoin...`);
        const { pieceCid, size } = await this.synapse.storage.upload(encryptedData);
        console.log(`[FilecoinStorage] ✅ Data uploaded. Piece CID: ${pieceCid}`);

        return { pieceCid, size };
    }

    /**
     * Downloads data from Filecoin using the Piece CID
     * Data is decrypted after download
     */
    async downloadFromFilecoin(pieceCid) {
        await this.initialize();

        console.log(`[FilecoinStorage] 📥 Downloading from Filecoin: ${pieceCid}...`);
        const encryptedData = await this.synapse.storage.download(pieceCid);
        console.log(`[FilecoinStorage] ✅ Data downloaded: ${encryptedData.length} bytes`);

        // Decrypt data after downloading
        console.log(`[FilecoinStorage] 🔓 Decrypting ${encryptedData.length} bytes...`);
        const data = await this.decryptData(encryptedData);
        console.log(`[FilecoinStorage] ✅ Data decrypted: ${data.length} bytes`);

        return data;
    }

    /**
     * Saves the mapping CID -> Piece CID in the metadata store
     */
    async saveMapping(cidString, pieceCid) {
        if (!this.metadataStore) {
            await this.initialize();
        }

        const cid = CID.parse(cidString);
        const partition = await this.metadataStore.partition("mappings");
        const pieceCidBytes = new TextEncoder().encode(pieceCid);
        await partition.put(cid, pieceCidBytes);
    }

    /**
     * Gets the Piece CID associated with a local CID
     */
    async getMapping(cidString) {
        if (!this.metadataStore) {
            await this.initialize();
        }

        const cid = CID.parse(cidString);
        const partition = await this.metadataStore.partition("mappings");
        const pieceCidBytes = await partition.get(cid);

        if (!pieceCidBytes) {
            return null;
        }

        return new TextDecoder().decode(pieceCidBytes);
    }

    /**
     * Closes the connections
     */
    async close() {
        if (this.metadataStore) {
            await this.metadataStore.close();
        }
        this.initialized = false;
    }
}

// Shared instance of FilecoinStorage
const filecoinStorage = new FilecoinStorage();

/**
 * MessageStore that stores messages in Filecoin
 * Uses LevelDB ONLY for indexes (required for queries) and metadata (mappings)
 * Actual data is stored in Filecoin
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

        // Upload the message to Filecoin
        try {
            const { pieceCid } = await filecoinStorage.uploadToFilecoin(
                encodedMessageBlock.bytes
            );
            // Save the mapping CID -> Piece CID
            await filecoinStorage.saveMapping(messageCidString, pieceCid);
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

        // Get the Piece CID from the metadata store
        const pieceCid = await filecoinStorage.getMapping(cidString);

        if (!pieceCid) {
            return undefined;
        }

        try {
            // Download from Filecoin
            console.log(
                `[FilecoinMessageStore] 📥 Retrieving message from Filecoin: ${pieceCid}`
            );
            const data = await filecoinStorage.downloadFromFilecoin(pieceCid);

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
 * Does not need indexes, only metadata for mappings
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

        // Upload to Filecoin
        try {
            const { pieceCid } = await filecoinStorage.uploadToFilecoin(data);
            // Save the mapping dataCid -> pieceCid
            await filecoinStorage.saveMapping(dataCid, pieceCid);
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
        // Get the Piece CID from the metadata store
        const pieceCid = await filecoinStorage.getMapping(dataCid);

        if (!pieceCid) {
            return undefined;
        }

        try {
            // Download from Filecoin
            console.log(
                `[FilecoinDataStore] 📥 Retrieving data from Filecoin: ${pieceCid}`
            );
            const data = await filecoinStorage.downloadFromFilecoin(pieceCid);

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
