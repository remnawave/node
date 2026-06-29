import prettyBytes from 'pretty-bytes';

import { INestApplication } from '@nestjs/common';

import { XrayService } from '../../modules/xray-core/xray.service';
import { getSystemInfo } from './get-system-stats';

const BOX_WIDTH = 60;

function wrap(text: string, width: number): string[] {
    const lines: string[] = [];

    for (const rawLine of text.split('\n')) {
        let current = '';

        for (const word of rawLine.split(' ')) {
            if (current && current.length + 1 + word.length > width) {
                lines.push(current);
                current = '';
            }
            current = current ? `${current} ${word}` : word;

            while (current.length > width) {
                lines.push(current.slice(0, width));
                current = current.slice(width);
            }
        }

        lines.push(current);
    }

    return lines;
}

function center(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const left = Math.floor(padding / 2);
    return ' '.repeat(left) + text + ' '.repeat(padding - left);
}

function renderBox(header: string, rows: string[]): string {
    const w = BOX_WIDTH;
    const horizontal = '─'.repeat(w);

    const out: string[] = [`┌${horizontal}┐`];
    out.push(`│${center(header, w)}│`);
    out.push(`├${horizontal}┤`);

    rows.forEach((row, index) => {
        for (const line of wrap(row, w)) {
            out.push(`│${center(line, w)}│`);
        }
        if (index < rows.length - 1) {
            out.push(`├${horizontal}┤`);
        }
    });

    out.push(`└${horizontal}┘`);
    return out.join('\n');
}

export async function getStartMessage(appPort: number, app: INestApplication) {
    const xrayService = app.get(XrayService);

    const xrayInfo = xrayService.getXrayInfo();
    const systemInfo = getSystemInfo();

    return renderBox(`Remnawave Node v${__RWNODE_VERSION__}`, [
        'Docs → https://docs.rw\nCommunity → https://t.me/remnawave',
        `API Port: ${appPort}`,
        `XRay Core: v${xrayInfo.version || 'N/A'}\nXRay Path: ${xrayInfo.path}`,
        `${systemInfo.cpus}C, ${systemInfo.cpuModel}, ${prettyBytes(systemInfo.memoryTotal)}`,
        `Kernel: ${systemInfo.release} ${systemInfo.type} ${systemInfo.platform}`,
        `Network Interfaces: ${systemInfo.networkInterfaces.join(', ')}`,
    ]);
}
