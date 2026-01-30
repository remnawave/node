import { generateMTLSCertificates, MTLSCertificates } from './generate-mtls-certs';

let mtlsCerts: MTLSCertificates | null = null;

export async function initializeMTLSCerts(): Promise<MTLSCertificates> {
    if (mtlsCerts) {
        return mtlsCerts;
    }

    mtlsCerts = await generateMTLSCertificates();

    return mtlsCerts;
}

export function getMTLSCerts(): MTLSCertificates {
    if (!mtlsCerts) {
        throw new Error('mTLS certificates not initialized. Call initializeMTLSCerts() first.');
    }
    return mtlsCerts;
}

export function getServerCerts() {
    const certs = getMTLSCerts();
    return {
        caCertPem: certs.ca.certPem,
        serverCertPem: certs.server.certPem,
        serverKeyPem: certs.server.keyPem,
    };
}

export function getClientCerts() {
    const certs = getMTLSCerts();
    return {
        caCertPem: certs.ca.certPem,
        clientCertPem: certs.client.certPem,
        clientKeyPem: certs.client.keyPem,
    };
}
