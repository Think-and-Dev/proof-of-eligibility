/**
 * Simplified Next.js API Route for Verifiable Credential Generation
 * 
 * This API route provides endpoints for generating VCs without DWN dependencies
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateVC, validateVC, generateMultipleVCs, generateAndSubmitVC } from '@/utils/vc-generator';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'generate') {
            return await handleGenerate(body);
        } else if (action === 'generate-multiple') {
            return await handleGenerateMultiple(body);
        } else if (action === 'submit') {
            return await handleSubmit(body);
        } else if (action === 'validate') {
            return await handleValidate(body);
        } else {
            return NextResponse.json({ 
                error: 'Invalid action. Use ?action=generate, ?action=generate-multiple, ?action=submit, or ?action=validate' 
            }, { status: 400 });
        }

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ 
            error: 'Internal server error',
            message: (error as Error).message 
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'health') {
            return NextResponse.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'VC Generator API'
            });
        } else {
            return NextResponse.json({ 
                error: 'Invalid action. Use ?action=health' 
            }, { status: 400 });
        }

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ 
            error: 'Internal server error',
            message: (error as Error).message 
        }, { status: 500 });
    }
}

/**
 * Handle VC generation
 */
async function handleGenerate(body: any) {
    try {
        const { subjectData, vcType, options } = body;

        if (!subjectData) {
            return NextResponse.json({ error: 'subjectData is required' }, { status: 400 });
        }

        if (!vcType) {
            return NextResponse.json({ error: 'vcType is required' }, { status: 400 });
        }

        // Generate VC
        const vcData = await generateVC(subjectData, vcType, options);

        // Validate generated VC
        const validation = validateVC(vcData.verifiableCredential);

        return NextResponse.json({
            success: true,
            verifiableCredential: vcData.verifiableCredential,
            did: vcData.did,
            authorizationSignatureInput: vcData.authorizationSignatureInput,
            validation: validation,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        return NextResponse.json({ 
            error: 'Failed to generate VC',
            message: (error as Error).message 
        }, { status: 400 });
    }
}

/**
 * Handle multiple VC generation
 */
async function handleGenerateMultiple(body: any) {
    try {
        const { subjectData, vcTypes } = body;

        if (!subjectData) {
            return NextResponse.json({ error: 'subjectData is required' }, { status: 400 });
        }

        // Generate multiple VCs
        const results = await generateMultipleVCs(subjectData, vcTypes);

        return NextResponse.json({
            success: true,
            results: results,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        return NextResponse.json({ 
            error: 'Failed to generate multiple VCs',
            message: (error as Error).message 
        }, { status: 400 });
    }
}

/**
 * Handle VC generation and submission to DWN
 */
async function handleSubmit(body: any) {
    try {
        const { subjectData, vcType, options } = body;

        if (!subjectData) {
            return NextResponse.json({ error: 'subjectData is required' }, { status: 400 });
        }

        if (!vcType) {
            return NextResponse.json({ error: 'vcType is required' }, { status: 400 });
        }

        // Generate and submit VC
        const result = await generateAndSubmitVC(subjectData, vcType, options);

        // Validate generated VC
        const validation = validateVC(result.verifiableCredential);

        return NextResponse.json({
            success: true,
            verifiableCredential: result.verifiableCredential,
            did: result.did,
            recordId: result.recordId,
            serverUrl: result.serverUrl,
            submissionResult: result.submissionResult,
            validation: validation,
            submittedAt: new Date().toISOString()
        });

    } catch (error) {
        return NextResponse.json({ 
            error: 'Failed to generate and submit VC',
            message: (error as Error).message 
        }, { status: 400 });
    }
}

/**
 * Handle VC validation
 */
async function handleValidate(body: any) {
    try {
        const { verifiableCredential } = body;

        if (!verifiableCredential) {
            return NextResponse.json({ error: 'verifiableCredential is required' }, { status: 400 });
        }

        // Validate VC
        const validation = validateVC(verifiableCredential);

        return NextResponse.json({
            success: true,
            validation: validation,
            validatedAt: new Date().toISOString()
        });

    } catch (error) {
        return NextResponse.json({ 
            error: 'Failed to validate VC',
            message: (error as Error).message 
        }, { status: 400 });
    }
}
