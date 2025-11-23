# 🏆 Proof of Eligibility - Clinical Trial Eligibility Verification

**A cutting-edge decentralized platform for clinical trial eligibility verification, leveraging Filecoin storage, Oasis privacy, and LIT Protocol encryption to create tamper-proof, privacy-preserving credential verification for medical research.**

## 🎯 Project Overview

Proof of Eligibility is a revolutionary decentralized identity system focused on transforming **clinical trial eligibility verification** - one of the most critical and privacy-sensitive use cases in healthcare. By combining the power of **Decentralized Web Nodes (DWN)**, **Filecoin storage**, **Oasis privacy features**, and **LIT Protocol encryption**, we create a comprehensive solution that enables secure, privacy-preserving eligibility verification for clinical trials while maintaining patient sovereignty over their medical data.

### 🌟 Core Innovation: Clinical Trial Focus

Our platform transforms the traditional clinical trial eligibility process - a complex, privacy-sensitive, and often inefficient system - into a decentralized, patient-controlled experience where individuals own their medical eligibility credentials and research institutions can verify them instantly without exposing sensitive health information. This is just one of many possible use cases, but clinical trials represent the perfect intersection of privacy requirements, regulatory compliance, and the need for trustworthy verification systems.

---

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   DWN Server     │    │   Filecoin      │    │   LIT Protocol  │
│   (Next.js)     │◄──►│  (Decentralized  │◄──►│   Storage       │◄──►│   Encryption    │
│                 │    │   Web Node)      │    │   (Plugin)      │    │   (Access Ctrl) │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                         │                       
         │               ┌──────────────────┐              │                       
         └──────────────►│  Oasis Network   │◄─────────────┘                       
                         │  (Privacy Layer) │                                      
                         └──────────────────┘                                      
```

---

## 🔧 Technology Stack & Integrations

### 🌐 **Decentralized Web Nodes (DWN) - Core Infrastructure**

#### **DWN Foundation**
- **Foundation Technology**: Built entirely on DWN, an open decentralized data storage protocol
- **Identity Management**: Uses DIDs (Decentralized Identifiers) for patient-controlled identity, following DID Core specification
- **Verifiable Credentials**: Implements W3C VC standard with DWN RecordsWrite/RecordsRead operations for medical credentials
- **Data Sovereignty**: Patients maintain complete control over their clinical trial eligibility data through personal DWN instances
- **Interoperability**: Fully compatible with the entire DWN ecosystem and IPFS network for healthcare data exchange

```typescript
// Clinical Trial Eligibility with DWN
const eligibilityCredential = await RecordsWrite.create({
    data: clinicalTrialEligibilityVC,
    dataFormat: 'application/json',
    authorizationSignatureInput: patientDID.authorizationSignatureInput,
});

// Submit to patient's DWN via JSON-RPC Protocol
const jsonRpcRequest = {
    jsonrpc: '2.0',
    method: 'dwn.processMessage',
    params: { target: patientDID, message: eligibilityCredential.toJSON() },
    id: uuidv4(),
};
```

#### **IPFS & Content Addressing for Medical Data**
- **Content Addressing**: Uses IPFS CID for immutable medical credential references
- **Network Effects**: Leverages existing IPFS infrastructure for medical data availability
- **Decentralized Access**: Clinical trial credentials accessible through any IPFS node
- **Version Control**: Natural versioning for medical history and eligibility changes

#### **Web5 & DID Technologies**
- **DID Generation**: Uses `@web5/dids` for cryptographic key management
- **Cross-Platform**: Browser and server-compatible DID operations
- **Standards Compliant**: Follows DID Core and DID Key specifications
- **Key Management**: Secure cryptographic operations across environments

### 💾 **Filecoin Integration - DWN Server Plugin Architecture**

#### **Innovative Plugin Integration**
- **Plugin-Based Architecture**: Developed Filecoin as a native plugin for our custom DWN server implementation
- **Seamless Integration**: Filecoin storage capabilities are directly integrated into the DWN server's data flow
- **High Adoptability**: Plugin architecture enables any DWN deployment to easily add Filecoin storage capabilities
- **Open Source Contribution**: The Filecoin plugin can be reused by any DWN implementation, dramatically expanding Filecoin's adoption potential

```typescript
// Filecoin Plugin for DWN Server
class FilecoinDWNPlugin {
    constructor(dwnServer, filecoinConfig) {
        this.dwnServer = dwnServer;
        this.storage = new FilecoinStorageManager(filecoinConfig);
        
        // Register plugin with DWN server
        dwnServer.registerPlugin('filecoin-backup', this);
    }
    
    async onRecordCreate(record) {
        // Automatically backup new records to Filecoin
        if (record.dataFormat === 'application/json' && 
            record.schema?.includes('clinical-trial-eligibility')) {
            
            const cid = await this.storage.backupCredential(record.data);
            
            // Store Filecoin CID as record metadata
            await this.dwnServer.addRecordMetadata(record.id, {
                filecoinBackup: cid,
                backupTimestamp: new Date().toISOString()
            });
        }
    }
}
```

#### **Decentralized Storage Backup Features**
- **Permanent Storage**: Critical eligibility credentials automatically backed up on Filecoin's decentralized storage network
- **Storage Deals**: Automated storage deal negotiation with Filecoin providers through the plugin
- **Content Persistence**: Credentials survive even if original DWN instances go offline
- **Cost Efficiency**: Optimized storage strategies for long-term credential archival
- **Plugin Distribution**: Easy installation and configuration for any DWN server deployment

```typescript
// Filecoin Storage Integration through Plugin
class FilecoinStorageManager {
    async backupCredential(vc: VerifiableCredential) {
        const storage = new Filecoin({
            privateKey: process.env.FILECOIN_PRIVATE_KEY,
            rpcUrl: process.env.FILECOIN_RPC_URL,
        });
        
        // Store with retrieval optimization
        const cid = await storage.storeWithDeal(JSON.stringify(vc), {
            provider: 'f01234', // Preferred storage provider
            duration: 5 * 365 * 24 * 60 * 60, // 5 years
            verified: true, // Verified client deals
        });
        
        return cid;
    }
}
```

#### **Storage Features**
- **Redundancy**: Multiple storage deals across Filecoin providers for reliability
- **Verification**: Cryptographic proof of storage integrity through Filecoin's proof system
- **Accessibility**: Public verification through IPFS gateway integration
- **Retrieval Markets**: Optimized retrieval through Filecoin's retrieval markets
- **Smart Contract Integration**: Programmable storage conditions and payments

### 🛡️ **Oasis Network Integration - Privacy-Preserving Computation**

#### **Confidential Computing Layer**
- **ParaTime Deployment**: Privacy-preserving verification logic runs in Oasis ParaTimes
- **Zero-Knowledge Proofs**: Privacy-preserving eligibility verification using zk-SNARKs
- **Data Encryption**: Sensitive eligibility criteria encrypted and processed in trusted execution environments
- **Compliance**: GDPR-compliant privacy controls with confidential smart contracts

```typescript
// Oasis Privacy Layer Integration
class OasisPrivacyManager {
    async createPrivateVerification(vc: VerifiableCredential, criteria: EligibilityCriteria) {
        // Encrypt eligibility criteria in Oasis ParaTime
        const encryptedCriteria = await this.encryptInParaTime(criteria);
        
        // Generate zero-knowledge proof of eligibility
        const zkProof = await this.generateZKProof({
            credential: vc.credentialSubject,
            criteria: encryptedCriteria,
            witness: this.generateWitness(vc, criteria)
        });
        
        return {
            encryptedCriteria,
            zkProof,
            verificationHash: await this.hashVerification(vc, zkProof)
        };
    }
}
```

#### **Privacy Features**
- **Selective Disclosure**: Users reveal only necessary eligibility information
- **Verifiable Computation**: Verification logic runs in trusted execution environments
- **Data Minimization**: Personal data never exposed unnecessarily
- **Audit Trail**: Immutable audit logs on Oasis blockchain with privacy preservation

### 🔐 **LIT Protocol Integration - Access Control & Encryption**

#### **Decentralized Encryption & Access Control**
- **Condition-Based Encryption**: Encrypt eligibility credentials with customizable access conditions
- **Dynamic Access Control**: Grant/revoke access based on token ownership, NFT possession, or other on-chain conditions
- **Cross-Chain Compatibility**: Works across multiple blockchains for access control
- **Key Management**: Decentralized key management without single points of failure

```typescript
// LIT Protocol Integration for Access Control
class LITAccessManager {
    async encryptCredentialWithAccess(vc: VerifiableCredential, accessConditions: AccessCondition[]) {
        const litNodeClient = new LitNodeClient({
            alertWhenUnauthorized: false,
            debug: false,
        });
        await litNodeClient.connect();
        
        // Define access conditions (e.g., must hold specific NFT)
        const unifiedAccessControlConditions = [
            {
                contractAddress: '0x1234567890123456789012345678901234567890',
                standardContractType: 'ERC721',
                chain: 'ethereum',
                method: 'ownerOf',
                parameters: [ ':userAddress' ],
                returnValueTest: {
                    comparator: '=',
                    value: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
                }
            }
        ];
        
        // Encrypt the credential
        const { encryptedString, symmetricKey } = await litJsSdk.encryptString(
            JSON.stringify(vc),
            unifiedAccessControlConditions
        );
        
        // Save encrypted data and access conditions
        return {
            encryptedData: encryptedString,
            encryptedSymmetricKey: await litJsSdk.saveEncryptionKey({
                unifiedAccessControlConditions,
                symmetricKey,
                authSig: await this.getAuthSig(),
            }),
            accessConditions: unifiedAccessControlConditions
        };
    }
    
    async decryptCredential(encryptedCredential: EncryptedCredential) {
        const litNodeClient = new LitNodeClient();
        await litNodeClient.connect();
        
        const symmetricKey = await litJsSdk.getEncryptionKey({
            unifiedAccessControlConditions: encryptedCredential.accessConditions,
            toDecrypt: encryptedCredential.encryptedSymmetricKey,
            authSig: await this.getAuthSig(),
        });
        
        const decryptedString = await litJsSdk.decryptString(
            encryptedCredential.encryptedData,
            symmetricKey
        );
        
        return JSON.parse(decryptedString);
    }
}
```

#### **LIT Features**
- **Programmable Access**: Define complex access conditions using smart contracts
- **Multi-Chain Support**: Access control across Ethereum, Polygon, BSC, and more
- **Revocable Access**: Dynamically revoke access without re-encryption
- **Circuit Breaker**: Emergency access controls for critical situations

---

## 🚀 Key Features

### 🔐 **Identity & Credentials**
- **Self-Sovereign Identity**: Users control their own DIDs and credentials through DWN
- **Multi-Issuer Support**: Multiple organizations can issue credentials to the same user
- **Cross-Chain Compatibility**: Works across different blockchain ecosystems
- **Revocation Management**: Secure credential revocation and renewal with privacy preservation

### 🌐 **Decentralized Infrastructure**
- **DWN-Powered**: All data stored on decentralized web nodes for true data ownership
- **No Single Points of Failure**: Resilient, censorship-resistant architecture
- **Peer-to-Peer**: Direct credential exchange between parties without intermediaries
- **Offline Capability**: Credentials accessible without internet connectivity through local DWN

### 📊 **Verification System**
- **Instant Verification**: Real-time eligibility confirmation through DWN queries
- **Privacy-Preserving**: Zero-knowledge proof verification on Oasis ParaTimes
- **Batch Processing**: Verify multiple credentials simultaneously
- **Audit Logging**: Complete verification audit trail with privacy controls

### 🔄 **Data Management**
- **Filecoin Backup**: Permanent credential archival on decentralized storage
- **LIT Encryption**: Granular access control and encryption
- **Version Control**: Track credential changes over time
- **Data Portability**: Easy export and import of credentials across platforms

---

## 🎯 Use Cases & Applications

### � **Clinical Trial Eligibility (Primary Implementation)**
- **Patient Matching**: Privacy-preserving matching of patients to clinical trials based on medical criteria
- **Regulatory Compliance**: HIPAA and GDPR-compliant eligibility verification for medical research
- **Informed Consent**: Cryptographic proof of informed consent with selective disclosure
- **Multi-Trial Participation**: Secure verification across multiple clinical trials without data duplication
- **Real-time Eligibility**: Instant verification of changing medical conditions and eligibility status

### ��️ **Government Programs**
- **Social Benefits**: Tamper-proof eligibility verification for welfare programs
- **Voting Systems**: Secure voter eligibility and identity verification with privacy
- **Healthcare**: Patient eligibility for medical programs and services

### 🎓 **Education & Employment**
- **Academic Credentials**: Verifiable degrees and certifications with access control
- **Professional Licensing**: Secure professional license verification
- **Employment Eligibility**: Work authorization and skill verification

### 💼 **Financial Services**
- **DeFi Eligibility**: Qualification for decentralized financial services
- **KYC/AML**: Compliance with regulatory requirements using privacy-preserving methods
- **Credit Scoring**: Decentralized credit history and eligibility

### 🌍 **Humanitarian Aid**
- **Refugee Assistance**: Secure eligibility for aid programs with privacy protection
- **Disaster Relief**: Rapid verification for emergency assistance
- **Cross-Border Support**: International eligibility verification

---

## 🛠️ Technical Implementation

### 📁 **Project Structure**
```
proof-of-eligibility/
├── frontend/                 # Next.js frontend application
│   ├── app/                 # App Router pages
│   ├── components/          # React components
│   ├── utils/               # DWN and VC utilities
│   └── types/               # TypeScript definitions
├── dwn-server-plugin/       # Custom DWN server implementation
│   ├── scripts/             # Test and utility scripts
│   ├── storage/             # Filecoin integration
│   ├── privacy/             # Oasis privacy layer
│   └── encryption/          # LIT Protocol integration
├── smart-contracts/         # Blockchain integration contracts
│   ├── oasis/               # Oasis ParaTime contracts
│   ├── filecoin/            # Filecoin storage contracts
│   └── access-control/      # LIT Protocol access contracts
└── docs/                    # Documentation and examples
```

### 🔗 **Integration Architecture**

#### **Multi-Layer Security Stack**
1. **DWN Layer**: Data storage and identity management
2. **Filecoin Layer**: Permanent backup and content addressing
3. **Oasis Layer**: Privacy-preserving computation
4. **LIT Layer**: Encryption and access control

#### **Cross-Protocol Communication**
- **Standard Protocols**: JSON-RPC for DWN, HTTP for Filecoin, gRPC for Oasis
- **Event-Driven Architecture**: Real-time updates across all layers
- **Fallback Mechanisms**: Redundancy and error handling across protocols

---

## 🏆 Competitive Advantages

### 🌟 **Technical Excellence**
- **First-Mover Advantage**: Earliest comprehensive integration of DWN, Filecoin, Oasis, and LIT
- **Multi-Layer Security**: Unprecedented security through protocol diversity
- **Standards Compliant**: Full W3C VC, DID, and DWN standard implementation
- **Cross-Platform**: Universal compatibility across devices and platforms

### 🛡️ **Privacy & Security**
- **Privacy by Design**: Built-in privacy protections from day one with Oasis and LIT
- **Zero-Knowledge**: Advanced cryptographic privacy features
- **Data Sovereignty**: Users maintain complete control over their data
- **Access Control**: Granular, programmable access control with LIT Protocol

### 🚀 **Scalability & Performance**
- **Decentralized Scaling**: Scales with the network, not centralized servers
- **Efficient Storage**: Optimized Filecoin storage strategies
- **Fast Verification**: Sub-second credential verification
- **Global Reach**: Works anywhere with internet access

### 💡 **Innovation**
- **Novel Architecture**: Unique combination of DWN, Filecoin, Oasis, and LIT
- **Privacy-Preserving**: Industry-leading privacy features
- **Developer Friendly**: Easy integration for existing applications
- **Future-Proof**: Designed for the evolving Web3 landscape

---

## 🎯 Hackathon Impact

### 🌐 **DWN Ecosystem Contribution**
- **DWN Infrastructure Leadership**: Significant contribution to the DWN ecosystem with production-ready implementation for clinical trial eligibility
- **Identity Infrastructure**: Critical infrastructure for Web3 identity using open DWN standards
- **IPFS Integration**: Seamless integration with IPFS for content addressing and medical data availability
- **Developer Tools**: Provides reusable components for DWN development in healthcare
- **Ecosystem Growth**: Enables new use cases for DWN technology in regulated industries

### 💾 **Filecoin Track - Plugin Innovation**
- **Storage Innovation**: Novel use of Filecoin for credential backup and permanence through native DWN server plugin
- **Plugin Architecture**: Developed the first Filecoin plugin for DWN servers, enabling massive Filecoin adoption
- **Storage Deal Optimization**: Advanced storage deal strategies for cost efficiency in healthcare data storage
- **Retrieval Optimization**: Efficient data retrieval mechanisms through Filecoin markets
- **Content Persistence**: Ensures long-term credential availability on decentralized storage
- **High Adoptability**: Plugin architecture allows any DWN deployment to easily add Filecoin storage capabilities
- **Open Source Contribution**: The Filecoin plugin can be reused by any DWN implementation, dramatically expanding Filecoin's adoption potential

### 🛡️ **Oasis Track - Privacy Innovation**
- **Privacy Innovation**: Advanced privacy-preserving verification using ParaTimes for clinical trial data
- **Confidential Computing**: Real-world application of Oasis trusted execution environments in healthcare
- **Zero-Knowledge Implementation**: Practical ZK proof system for identity verification in medical research
- **Compliance Solution**: GDPR and HIPAA-compliant privacy controls for sensitive medical data
- **ParaTime Applications**: Demonstrates practical use cases for Oasis ParaTimes in regulated industries

### 🔐 **LIT Protocol Integration - Access Control Leadership**
- **Access Control Innovation**: Advanced encryption with programmable access conditions for medical credentials
- **Cross-Chain Access**: Multi-chain access control for credential management across healthcare systems
- **Dynamic Permissions**: Real-time access control updates without re-encryption for clinical trial participation
- **Enterprise Features**: Circuit breaker and emergency access controls for critical healthcare scenarios
- **Healthcare Integration**: First implementation of LIT Protocol specifically designed for clinical trial eligibility

---

## 🚀 Demo & Testing

### 🌐 **Live Demo**
- **Frontend**: `http://localhost:3000/vc-generator`
- **DWN Server**: `http://localhost:3002`
- **Filecoin Integration**: Testnet deployment with storage deals
- **Oasis Privacy**: ParaTime integration with zk-proofs
- **LIT Protocol**: Live encryption and access control demo

### 🧪 **Testing Suite**
```bash
# Start DWN Server
cd dwn-server-plugin
npm start

# Start Frontend
cd frontend
npm run dev

# Test VC Generation with DWN
curl -X POST http://localhost:3000/api/vc-simple?action=generate \
  -H "Content-Type: application/json" \
  -d '{"subjectData":{"eligibility":true},"vcType":"ProofOfEligibility"}'

# Test Filecoin Backup
node scripts/test-filecoin-backup.js

# Test Oasis Privacy
node scripts/test-oasis-privacy.js

# Test LIT Encryption
node scripts/test-lit-encryption.js
```

---

## 🎯 Roadmap

### 📅 **Short Term (Post-Hackathon)**
- [ ] Production deployment on Filecoin mainnet
- [ ] Oasis ParaTime optimization for zk-proofs
- [ ] Mobile application development
- [ ] Multi-language support
- [ ] Enhanced LIT Protocol access conditions

### 📅 **Medium Term**
- [ ] DAO governance for credential standards
- [ ] Advanced zero-knowledge proof systems
- [ ] Integration with major Web3 platforms
- [ ] Enterprise partnerships
- [ ] Cross-chain LIT Protocol expansion

### 📅 **Long Term**
- [ ] Global identity network
- [ ] Cross-chain interoperability
- [ ] AI-powered eligibility assessment
- [ ] Quantum-resistant cryptography
- [ ] Protocol Labs ecosystem leadership

---

## 👥 Team & Vision

We are a team of passionate developers dedicated to creating a more private, secure, and user-controlled digital identity future. Our vision is a world where everyone owns their identity and can prove their eligibility without sacrificing privacy or control.

### 🏆 **Why We Win**
- **Technical Excellence**: Deep expertise in DWN, Filecoin, Oasis, and LIT technologies
- **Real-World Impact**: Solving actual problems in identity verification
- **Innovation**: Novel architecture combining multiple cutting-edge technologies
- **Execution**: Working demo with all integrations functional
- **Protocol Labs Alignment**: Perfect alignment with Protocol Labs' mission for decentralized infrastructure

---

## 📞 Contact & Resources

- **GitHub**: [Project Repository](https://github.com/your-org/proof-of-eligibility)
- **Demo**: [Live Application](https://demo.proof-of-eligibility.com)
- **Documentation**: [Technical Docs](https://docs.proof-of-eligibility.com)
- **Contact**: [team@proof-of-eligibility.com](mailto:team@proof-of-eligibility.com)

---

## 🎉 Join Us in Revolutionizing Digital Identity

**Proof of Eligibility** is not just a hackathon project—it's the foundation for a more private, secure, and user-controlled digital future. By leveraging the combined power of Protocol Labs' DWN ecosystem, Filecoin's decentralized storage, Oasis's privacy layer, and LIT Protocol's encryption, we're creating the identity infrastructure that Web3 has been waiting for.

**Built with Protocol Labs technologies, powered by Filecoin storage, protected by Oasis privacy, and secured by LIT encryption.**

**Let's build the future of identity—together.** 🚀
