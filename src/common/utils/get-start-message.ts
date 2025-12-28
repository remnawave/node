import { getBorderCharacters, table } from 'table';
import { readPackageJSON } from 'pkg-types';

import { INestApplication } from '@nestjs/common';

import { getInternalRestPort, getSupervisordPort, getXtlsApiPort } from './get-initial-ports';
import { XrayService } from '../../modules/xray-core/xray.service';

export async function getStartMessage(appPort: number, app: INestApplication) {
    const pkg = await readPackageJSON();

    const xrayService = app.get(XrayService);

    const xrayInfo = xrayService.getXrayInfo();

    return table(
        [
            ['Docs → https://docs.rw\nCommunity → https://t.me/remnawave'],
            [
                `API Port: ${appPort}\nInternal Ports: ${getXtlsApiPort()}, ${getInternalRestPort()}, ${getSupervisordPort()}`,
            ],
            [`XRay Core: v${xrayInfo.version || 'N/A'}\nXRay Path: ${xrayInfo.path}`],
            [
                `SI: ${xrayInfo.systemInfo?.cpuCores}C, ${xrayInfo.systemInfo?.cpuModel}, ${xrayInfo.systemInfo?.memoryTotal}`,
            ],
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
