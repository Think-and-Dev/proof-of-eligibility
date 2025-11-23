/**
 * Simplified React Component for Verifiable Credential Generation
 * 
 * This component provides a UI for generating VCs without DWN dependencies
 */

'use client';

import React, { useState } from 'react';
import { generateVC, validateVC, generateAndSubmitVC, downloadVC, copyVCToClipboard } from '@/utils/vc-generator';

// Type definitions
interface VCFormData {
    vcType: string;
    subjectData: {
        eligibility: boolean;
        program: string;
        participantId: string;
    };
}

interface VCResult {
    type: 'generated' | 'submitted';
    data: {
        success?: boolean;
        verifiableCredential: Record<string, any>;
        did: string;
        recordId?: string;
        serverUrl?: string;
        submissionResult?: any;
        validation: {
            isValid: boolean;
            errors: string[];
            warnings: string[];
        };
        generatedAt?: string;
        submittedAt?: string;
    };
}

const SimpleVCGenerator: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<VCResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [downloaded, setDownloaded] = useState(false);
    const [formData, setFormData] = useState<VCFormData>({
        vcType: 'ProofOfEligibility',
        subjectData: {
            eligibility: true,
            program: 'Proof of Eligibility Program',
            participantId: 'user123'
        }
    });

    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name.startsWith('subject.')) {
            const subjectField = name.replace('subject.', '');
            setFormData(prev => ({
                ...prev,
                subjectData: {
                    ...prev.subjectData,
                    [subjectField]: value === 'true' ? true : value === 'false' ? false : value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    // Generate VC
    const handleGenerateVC = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);
        setCopied(false);
        setDownloaded(false);

        try {
            const response = await fetch('/api/vc-simple?action=generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subjectData: formData.subjectData,
                    vcType: formData.vcType
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to generate VC');
            }

            setResult({
                type: 'generated',
                data: data
            });

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // Generate and submit VC to DWN (using API route)
    const handleSubmitVC = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);
        setCopied(false);
        setDownloaded(false);

        try {
            const response = await fetch('/api/vc-simple?action=submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subjectData: formData.subjectData,
                    vcType: formData.vcType,
                    options: {
                        submissionOptions: {
                            serverUrl: process.env.NEXT_PUBLIC_DWN_SERVER_URL || 'http://localhost:3000'
                        }
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to submit VC');
            }

            setResult({
                type: 'submitted',
                data: data
            });

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // Copy VC to clipboard
    const handleCopyToClipboard = async () => {
        if (!result) return;

        try {
            const vcData = {
                verifiableCredential: result.data.verifiableCredential,
                did: result.data.did,
                vcJson: JSON.stringify(result.data.verifiableCredential, null, 2),
                vcBytes: new TextEncoder().encode(JSON.stringify(result.data.verifiableCredential))
            };

            const success = await copyVCToClipboard(vcData.vcJson);
            if (success) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Download VC as JSON
    const handleDownload = () => {
        if (!result) return;

        try {
            const vcData = {
                verifiableCredential: result.data.verifiableCredential,
                did: result.data.did,
                vcJson: JSON.stringify(result.data.verifiableCredential, null, 2),
                vcBytes: new TextEncoder().encode(JSON.stringify(result.data.verifiableCredential))
            };

            downloadVC(vcData.vcJson, `${formData.vcType}-${Date.now()}.json`);
            setDownloaded(true);
            setTimeout(() => setDownloaded(false), 2000);
        } catch (err) {
            console.error('Failed to download:', err);
        }
    };

    // Reset form
    const handleReset = () => {
        setFormData({
            vcType: 'ProofOfEligibility',
            subjectData: {
                eligibility: true,
                program: 'Proof of Eligibility Program',
                participantId: 'user123'
            }
        });
        setResult(null);
        setError(null);
        setCopied(false);
        setDownloaded(false);
    };

    return (
        <div className="vc-generator" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <h1>🔐 Verifiable Credential Generator</h1>
            <p>Generate Verifiable Credentials with validation and export options</p>

            {/* Form Section */}
            <div className="form-section" style={{ 
                border: '1px solid #ddd', 
                borderRadius: '8px', 
                padding: '20px', 
                marginBottom: '20px' 
            }}>
                <h2>📝 Credential Details</h2>
                
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        VC Type:
                    </label>
                    <select
                        name="vcType"
                        value={formData.vcType}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                        <option value="ProofOfEligibility">Proof of Eligibility</option>
                        <option value="ProofOfAttendance">Proof of Attendance</option>
                        <option value="ProofOfCompletion">Proof of Completion</option>
                        <option value="ProofOfMembership">Proof of Membership</option>
                    </select>
                </div>

                <h3>Subject Data:</h3>
                
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Eligibility:
                    </label>
                    <select
                        name="subject.eligibility"
                        value={formData.subjectData.eligibility.toString()}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                        <option value="true">True</option>
                        <option value="false">False</option>
                    </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Program:
                    </label>
                    <input
                        type="text"
                        name="subject.program"
                        value={formData.subjectData.program}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Participant ID:
                    </label>
                    <input
                        type="text"
                        name="subject.participantId"
                        value={formData.subjectData.participantId}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                        onClick={handleGenerateVC}
                        disabled={isLoading}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isLoading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isLoading ? '⏳ Generating...' : '🔑 Generate VC'}
                    </button>

                    <button
                        onClick={handleSubmitVC}
                        disabled={isLoading}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isLoading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isLoading ? '⏳ Submitting...' : '📤 Generate & Submit to DWN'}
                    </button>

                    <button
                        onClick={handleReset}
                        disabled={isLoading}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isLoading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        🔄 Reset
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div style={{
                    backgroundColor: '#f8d7da',
                    color: '#721c24',
                    padding: '15px',
                    borderRadius: '4px',
                    marginBottom: '20px'
                }}>
                    <strong>❌ Error:</strong> {error}
                </div>
            )}

            {/* Result Display */}
            {result && (
                <div className="result-section" style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '20px',
                    marginBottom: '20px'
                }}>
                    <h2>
                        {result.type === 'generated' ? '🔑 Generated Verifiable Credential' : '📤 Submitted to DWN'}
                    </h2>

                    {/* Action Buttons for Result */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <button
                            onClick={handleCopyToClipboard}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: copied ? '#28a745' : '#17a2b8',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            {copied ? '✅ Copied!' : '📋 Copy to Clipboard'}
                        </button>

                        <button
                            onClick={handleDownload}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: downloaded ? '#28a745' : '#6f42c1',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            {downloaded ? '✅ Downloaded!' : '💾 Download JSON'}
                        </button>
                    </div>

                    {/* VC Display */}
                    <div style={{ marginBottom: '20px' }}>
                        <h3>📄 Verifiable Credential:</h3>
                        <pre style={{
                            backgroundColor: '#f8f9fa',
                            padding: '15px',
                            borderRadius: '4px',
                            overflow: 'auto',
                            fontSize: '12px',
                            maxHeight: '300px'
                        }}>
                            {JSON.stringify(result.data.verifiableCredential, null, 2)}
                        </pre>
                    </div>

                    {/* DID Info */}
                    <div style={{ marginBottom: '20px' }}>
                        <h3>🔐 DID:</h3>
                        <code style={{ backgroundColor: '#e9ecef', padding: '5px', borderRadius: '3px' }}>
                            {result.data.did}
                        </code>
                    </div>

                    {/* Validation */}
                    <div style={{ marginBottom: '20px' }}>
                        <h3>✅ Validation:</h3>
                        <div style={{
                            backgroundColor: result.data.validation.isValid ? '#d4edda' : '#f8d7da',
                            color: result.data.validation.isValid ? '#155724' : '#721c24',
                            padding: '10px',
                            borderRadius: '4px'
                        }}>
                            <strong>Status:</strong> {result.data.validation.isValid ? 'Valid' : 'Invalid'}
                            {result.data.validation.errors.length > 0 && (
                                <div>
                                    <strong>Errors:</strong>
                                    <ul>
                                        {result.data.validation.errors.map((error: string, index: number) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {result.data.validation.warnings.length > 0 && (
                                <div>
                                    <strong>Warnings:</strong>
                                    <ul>
                                        {result.data.validation.warnings.map((warning: string, index: number) => (
                                            <li key={index}>{warning}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* DWN Submission Info (only if submitted) */}
                    {result.type === 'submitted' && result.data.recordId && (
                        <div>
                            <h3>🌐 DWN Submission:</h3>
                            <div style={{ backgroundColor: '#d1ecf1', padding: '10px', borderRadius: '4px' }}>
                                <p><strong>Record ID:</strong> {result.data.recordId}</p>
                                <p><strong>Server URL:</strong> {result.data.serverUrl}</p>
                                <p><strong>Submitted at:</strong> {result.data.submittedAt}</p>
                            </div>
                        </div>
                    )}

                    {/* Metadata */}
                    <div>
                        <h3>📊 Metadata:</h3>
                        <p><strong>Generated at:</strong> {result.data.generatedAt}</p>
                        <p><strong>VC Type:</strong> {formData.vcType}</p>
                    </div>
                </div>
            )}

            {/* Usage Instructions */}
            <div className="instructions" style={{
                backgroundColor: '#f8f9fa',
                padding: '20px',
                borderRadius: '8px',
                marginTop: '20px'
            }}>
                <h2>📖 Usage Instructions</h2>
                <ol>
                    <li><strong>Fill in the form:</strong> Select VC type and enter subject data</li>
                    <li><strong>Generate VC:</strong> Creates a Verifiable Credential with proper structure</li>
                    <li><strong>Validate:</strong> Automatic validation checks for required fields and format</li>
                    <li><strong>Export:</strong> Copy to clipboard or download as JSON file</li>
                </ol>
                
                <h3>🔗 Integration</h3>
                <p>This simplified version focuses on VC generation and validation. For DWN server integration, you can extend the utility with the appropriate DID and DWN SDK libraries.</p>
            </div>
        </div>
    );
};

export default SimpleVCGenerator;
