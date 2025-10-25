interface INodePayload {
    caCertPem: string;
    jwtPublicKey: string;
    nodeCertPem: string;
    nodeKeyPem: string;
}

export function parseNodePayload(): INodePayload {
    let nodePayload = process.env.SECRET_KEY;

    if (!nodePayload) {
        nodePayload = process.env.SSL_CERT;
    }

    if (!nodePayload) {
        throw new Error('SECRET_KEY is not set');
    }

    try {
        const parsed = JSON.parse(Buffer.from(nodePayload, 'base64').toString('utf-8'));

        if (!isValidNodePayload(parsed)) {
            throw new Error('Invalid SECRET_KEY payload structure');
        }

        return parsed;
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

        return parsed;
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
