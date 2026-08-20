import { Logger } from 'winston';

import { INodePayload } from './node-payload.interface';
import { assertPayloadIntegrity } from './validate-secret-key.util';

function normalizePem(pem: string): string {
    let normalized = pem.replace(/\\n/g, '\n');
    normalized = normalized.replace(/\r\n/g, '\n');
    normalized = normalized.replace(/(-----BEGIN [A-Z ]+-----)/g, '$1\n');
    normalized = normalized.replace(/(-----END [A-Z ]+-----)/g, '\n$1');
    normalized = normalized.replace(/\n+/g, '\n');

    normalized = normalized.trim();
    return normalized;
}

export function parseNodePayload(logger: Logger): INodePayload {
    const nodePayload = process.env.SECRET_KEY;

    if (!nodePayload) {
        throw new Error('SECRET_KEY missing in environment variables.');
    }

    try {
        const parsed = JSON.parse(Buffer.from(nodePayload, 'base64').toString('utf-8'));

        if (!isValidNodePayload(parsed)) {
            throw new Error('Invalid SECRET_KEY payload structure');
        }

        const result: INodePayload = {
            caCertPem: normalizePem(parsed.caCertPem),
            jwtPublicKey: normalizePem(parsed.jwtPublicKey),
            nodeCertPem: normalizePem(parsed.nodeCertPem),
            nodeKeyPem: normalizePem(parsed.nodeKeyPem),
        };

        assertPayloadIntegrity(result, logger);
        return result;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error('SECRET_KEY contains invalid JSON');
        }
        throw error;
    }
}

export function parseNodePayloadFromConfigService(sslCert: string): INodePayload {
    try {
        const parsed = JSON.parse(Buffer.from(sslCert, 'base64').toString('utf-8'));

        if (!isValidNodePayload(parsed)) {
            throw new Error('Invalid SECRET_KEY payload structure');
        }

        return {
            caCertPem: normalizePem(parsed.caCertPem),
            jwtPublicKey: normalizePem(parsed.jwtPublicKey),
            nodeCertPem: normalizePem(parsed.nodeCertPem),
            nodeKeyPem: normalizePem(parsed.nodeKeyPem),
        };
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error('SECRET_KEY contains invalid JSON');
        }
        throw error;
    }
}

function isValidNodePayload(payload: unknown): payload is INodePayload {
    if (!payload || typeof payload !== 'object') return false;

    return (
        'caCertPem' in payload &&
        typeof payload.caCertPem === 'string' &&
        'jwtPublicKey' in payload &&
        typeof payload.jwtPublicKey === 'string' &&
        'nodeCertPem' in payload &&
        typeof payload.nodeCertPem === 'string' &&
        'nodeKeyPem' in payload &&
        typeof payload.nodeKeyPem === 'string'
    );
}
