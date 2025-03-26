import { getBorderCharacters, table } from 'table';
import { readPackageJSON } from 'pkg-types';

export async function getStartMessage(appPort: number, internalPort: number) {
    const pkg = await readPackageJSON();

    return table(
        [
            ['Docs → https://remna.st\nCommunity → https://t.me/remnawave'],
            [`API Port: ${appPort}\nInternal Port: ${internalPort}`],
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
