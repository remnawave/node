import { styleText } from 'node:util';

import { BoxLineKind, renderBox } from './render-box';

function paint(line: string, kind: BoxLineKind): string {
    if (process.env.NO_COLOR) return line;

    return styleText(kind === 'title' ? ['bold', 'red'] : 'red', line, { validateStream: false });
}

export function getDuplicateInstanceMessage(): string {
    return renderBox(
        'ANOTHER REMNAWAVE NODE IS ALREADY RUNNING',
        [
            'A second instance was detected in this network namespace. Both act on the ' +
                'same host-level state, which leads to unexpected behaviour that is hard ' +
                'to trace back to its cause.',
            'Running more than one node per network namespace is not supported and is ' +
                'strongly discouraged. Use one node per host, or give each container a ' +
                'namespace of its own.',
        ],
        { align: 'left', decorate: paint, width: 76 },
    );
}
