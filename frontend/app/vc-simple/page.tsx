/**
 * Next.js Page for Simplified Verifiable Credential Generation
 * 
 * This page provides a complete interface for generating VCs without DWN dependencies
 */

import SimpleVCGenerator from '@/components/SimpleVCGenerator';

export default function SimpleVCPage() {
    return (
        <main style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
            {/* Header */}
            <header style={{ 
                backgroundColor: '#fff', 
                borderBottom: '1px solid #ddd', 
                padding: '20px 0' 
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
                    <h1 style={{ margin: 0, color: '#333' }}>
                        🔐 Verifiable Credential Generator
                    </h1>
                    <p style={{ margin: '5px 0 0 0', color: '#666' }}>
                        Generate, validate, and export Verifiable Credentials
                    </p>
                </div>
            </header>

            {/* Main Content */}
            <div style={{ padding: '40px 0' }}>
                <SimpleVCGenerator />
            </div>

            {/* Footer */}
            <footer style={{ 
                backgroundColor: '#fff', 
                borderTop: '1px solid #ddd', 
                padding: '20px 0',
                marginTop: '40px'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: '#666' }}>
                        Frontend Verifiable Credential Implementation
                    </p>
                </div>
            </footer>
        </main>
    );
}
