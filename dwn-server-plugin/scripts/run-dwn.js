import { DwnServer } from '@web5/dwn-server';
// node.js 18 and earlier, needs globalThis.crypto polyfill. needed for dwn-sdk-js
import { webcrypto } from 'node:crypto';

import dotenv from 'dotenv';
dotenv.config();

if (!globalThis.crypto) {
    // @ts-ignore
    globalThis.crypto = webcrypto;
}

const dwnServer = new DwnServer();
await dwnServer.start()
