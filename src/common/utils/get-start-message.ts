import { getBorderCharacters, table } from 'table';
import { readPackageJSON } from 'pkg-types';
import prettyBytes from 'pretty-bytes';

import { INestApplication } from '@nestjs/common';

import { XrayService } from '../../modules/xray-core/xray.service';
import { getXtlsApiPort } from './get-initial-ports';
import { getHostInfo } from './get-system-stats';

export async function getStartMessage(appPort: number, app: INestApplication) {
    const pkg = await readPackageJSON();

    const xrayService = app.get(XrayService);

    const xrayInfo = xrayService.getXrayInfo();
    const hostInfo = getHostInfo();

    return table(
        [
            ['Docs → https://docs.rw\nCommunity → https://t.me/remnawave'],
            [`API Port: ${appPort}\nInternal Ports: ${getXtlsApiPort()}`],
            [`XRay Core: v${xrayInfo.version || 'N/A'}\nXRay Path: ${xrayInfo.path}`],
            [`${hostInfo.cpus}C, ${hostInfo.cpuModel}, ${prettyBytes(hostInfo.memoryTotal)}`],
            [`Kernel: ${hostInfo.release} ${hostInfo.type} ${hostInfo.platform}`],
            [`Network Interfaces: ${hostInfo.networkInterfaces.join(', ')}`],
        ],
        {
            header: {
                content: `Remnawave Node v${pkg.version}`,
                alignment: 'center',
            },
            columnDefault: {
                width: 60,
            },
            columns: {
                0: { alignment: 'center' },
                1: { alignment: 'center' },
            },
            drawVerticalLine: () => false,
            border: getBorderCharacters('ramac'),
        },
    );
}
