export type BoxLineKind = 'line' | 'title';

export interface RenderBoxOptions {
    align?: 'center' | 'left';
    decorate?: (line: string, kind: BoxLineKind) => string;
    width?: number;
}

const DEFAULT_WIDTH = 62;

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

function pad(text: string, width: number): string {
    return text + ' '.repeat(Math.max(0, width - text.length));
}

function center(text: string, width: number): string {
    const left = Math.floor(Math.max(0, width - text.length) / 2);
    return pad(' '.repeat(left) + text, width);
}

export function renderBox(
    title: string,
    sections: string[],
    options: RenderBoxOptions = {},
): string {
    const { align = 'center', decorate = (line) => line, width = DEFAULT_WIDTH } = options;

    const inner = width - 4;
    const horizontal = '─'.repeat(width - 2);

    const out: string[] = [decorate(`┌${horizontal}┐`, 'line')];

    out.push(decorate(`│ ${center(title, inner)} │`, 'title'));

    sections.forEach((section) => {
        out.push(decorate(`├${horizontal}┤`, 'line'));

        for (const text of wrap(section, inner)) {
            out.push(
                decorate(
                    `│ ${align === 'center' ? center(text, inner) : pad(text, inner)} │`,
                    'line',
                ),
            );
        }
    });

    out.push(decorate(`└${horizontal}┘`, 'line'));

    return out.join('\n');
}
