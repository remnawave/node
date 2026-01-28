import {
    cryptoProvider,
    X509CertificateGenerator,
    BasicConstraintsExtension,
    KeyUsagesExtension,
    KeyUsageFlags,
    ExtendedKeyUsageExtension,
} from '@peculiar/x509';
import { Crypto } from '@peculiar/webcrypto';

export interface MTLSCertificates {
    ca: {
        certPem: string;
        keyPem: string;
    };
    server: {
        certPem: string;
        keyPem: string;
    };
    client: {
        certPem: string;
        keyPem: string;
    };
}

/**
 * Generate a complete set of mTLS certificates using RSA:
 * - CA certificate (self-signed, for signing server and client certs)
 * - Server certificate (signed by CA, serverAuth)
 * - Client certificate (signed by CA, clientAuth)
 */
export async function generateMTLSCertificates(): Promise<MTLSCertificates> {
    const crypto = new Crypto();
    cryptoProvider.set(crypto);

    const RSA_ALGORITHM: RsaHashedKeyGenParams = {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
    };

    // === CA Certificate ===
    const caKeys = await crypto.subtle.generateKey(RSA_ALGORITHM, true, ['sign', 'verify']);
    const caCert = await X509CertificateGenerator.createSelfSigned({
        serialNumber: '01',
        name: 'CN=Remnawave Internal CA',
        notBefore: new Date(),
        notAfter: new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
        keys: caKeys,
        signingAlgorithm: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        extensions: [
            new BasicConstraintsExtension(true, undefined, true),
            new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
        ],
    });

    // === Server Certificate ===
    const serverKeys = await crypto.subtle.generateKey(RSA_ALGORITHM, true, ['sign', 'verify']);
    const serverCert = await X509CertificateGenerator.create({
        serialNumber: '02',
        subject: 'CN=internal.remnawave.local',
        issuer: caCert.subjectName,
        notBefore: new Date(),
        notAfter: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
        publicKey: serverKeys.publicKey,
        signingKey: caKeys.privateKey,
        signingAlgorithm: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        extensions: [
            new BasicConstraintsExtension(false, undefined, true),
            new KeyUsagesExtension(
                KeyUsageFlags.digitalSignature | KeyUsageFlags.keyEncipherment,
                true,
            ),
            new ExtendedKeyUsageExtension(['1.3.6.1.5.5.7.3.1'], true), // serverAuth
        ],
    });

    // === Client Certificate ===
    const clientKeys = await crypto.subtle.generateKey(RSA_ALGORITHM, true, ['sign', 'verify']);
    const clientCert = await X509CertificateGenerator.create({
        serialNumber: '03',
        subject: 'CN=internal.remnawave.local',
        issuer: caCert.subjectName,
        notBefore: new Date(),
        notAfter: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
        publicKey: clientKeys.publicKey,
        signingKey: caKeys.privateKey,
        signingAlgorithm: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        extensions: [
            new BasicConstraintsExtension(false, undefined, true),
            new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
            new ExtendedKeyUsageExtension(['1.3.6.1.5.5.7.3.2'], true), // clientAuth
        ],
    });

    return {
        ca: {
            certPem: caCert.toString('pem'),
            keyPem: await exportKeyToPem(crypto, caKeys.privateKey),
        },
        server: {
            certPem: serverCert.toString('pem'),
            keyPem: await exportKeyToPem(crypto, serverKeys.privateKey),
        },
        client: {
            certPem: clientCert.toString('pem'),
            keyPem: await exportKeyToPem(crypto, clientKeys.privateKey),
        },
    };
}

async function exportKeyToPem(crypto: Crypto, key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('pkcs8', key);
    const b64 = Buffer.from(exported).toString('base64');
    const formatted = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
    return `-----BEGIN PRIVATE KEY-----\n${formatted}\n-----END PRIVATE KEY-----`;
}
