// Type declarations for @decentralized-identity/ion-tools
declare module '@decentralized-identity/ion-tools' {
    export interface KeyPair {
        privateJwk: any;
        publicJwk: any;
    }

    export interface DIDOptions {
        content: {
            publicKeys: Array<{
                id: string;
                type: string;
                publicKeyJwk: any;
                purposes: string[];
            }>;
        };
    }

    export class DID {
        constructor(options: DIDOptions);
        getURI(format?: 'short' | 'long'): Promise<string>;
    }

    export function generateKeyPair(): Promise<KeyPair>;
}
