import { X509Certificate, createPublicKey } from 'node:crypto';
import { Logger } from 'winston';

import { renderBox } from '../render-box';
import { deriveSni } from './decode-servername.util';
import { INodePayload } from './node-payload.interface';

interface ICheckResult {
    name: string;
    ok: boolean;
    detail: string;
}

function runPayloadChecks(p: INodePayload): ICheckResult[] {
    const checks: ICheckResult[] = [];
    const add = (name: string, fn: () => string | undefined): void => {
        try {
            checks.push({ name, ok: true, detail: fn() ?? '' });
        } catch (e) {
            checks.push({
                name,
                ok: false,
                detail: e instanceof Error ? e.message.split('\n')[0] : String(e),
            });
        }
    };

    let ca: X509Certificate | undefined;
    let node: X509Certificate | undefined;

    add('CA parses', () => {
        ca = new X509Certificate(p.caCertPem);
        return ca.fingerprint256.slice(0, 24);
    });
    add('CA not expired', () => {
        if (!ca) throw new Error('CA unavailable');
        const now = new Date();
        if (new Date(ca.validFrom) > now) throw new Error('not yet valid');
        if (new Date(ca.validTo) < now) throw new Error('expired');
        return `until ${ca.validTo}`;
    });
    add('CA self-signature', () => {
        if (!ca) throw new Error('CA unavailable');
        if (!ca.verify(ca.publicKey)) throw new Error('mismatch – corrupted');
        return 'valid';
    });
    add('node cert parses', () => {
        node = new X509Certificate(p.nodeCertPem);
        return node.fingerprint256.slice(0, 24);
    });
    add('node signed by CA', () => {
        if (!ca || !node) throw new Error('cert unavailable');
        if (!node.verify(ca.publicKey)) throw new Error('not signed by this CA');
        return 'valid';
    });
    add('node key matches cert', () => {
        if (!node) throw new Error('cert unavailable');
        const certPub = node.publicKey.export({ type: 'spki', format: 'der' });
        const keyPub = createPublicKey(p.nodeKeyPem).export({ type: 'spki', format: 'der' });
        if (!certPub.equals(keyPub)) throw new Error('key does not match cert');
        return 'valid';
    });
    add('jwt public key', () => {
        createPublicKey(p.jwtPublicKey);
        return 'ok';
    });

    return checks;
}

export function assertPayloadIntegrity(p: INodePayload, logger: Logger): void {
    const checks = runPayloadChecks(p);
    const allOk = checks.every((c) => c.ok);

    const width = 62;
    const inner = width - 4;
    const labelW = Math.max(...checks.map((c) => c.name.length));

    const rows = checks.map((c) => {
        const line = `${c.ok ? '✓' : '✗'} ${c.name.padEnd(labelW)}  ${c.detail}`;
        return line.length > inner ? line.slice(0, inner - 1) + '…' : line;
    });

    const sections = [rows.join('\n')];

    if (allOk) {
        const sni = deriveSni(p.caCertPem, p.jwtPublicKey);
        const leftPad = Math.max(0, Math.floor((inner - sni.length) / 2));
        const centered = (' '.repeat(leftPad) + sni).padEnd(inner);
        sections.push(centered.replace(/ /g, '\u00A0'));
    }

    const report = renderBox(allOk ? 'SECRET_KEY OK' : 'SECRET_KEY INVALID', sections, {
        align: 'left',
        width,
    });

    if (allOk) {
        logger.info('\n' + report);
    } else {
        logger.error('\n' + report);
        throw new Error('SECRET_KEY payload validation failed. Double check your SECRET_KEY.');
    }
}
