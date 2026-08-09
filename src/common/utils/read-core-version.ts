import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import semver from 'semver';

const execFileAsync = promisify(execFile);
const EXEC_TIMEOUT_MS = 3_000;

export interface ICoreVersion {
    raw: string;
    semver: null | string;
}

export async function readCoreVersion(path: string): Promise<ICoreVersion> {
    const { stdout } = await execFileAsync(path, ['version'], { timeout: EXEC_TIMEOUT_MS });

    const raw = stdout.split('\n')[0]?.trim();

    if (!raw) throw new Error('binary produced no version output');

    return { raw, semver: semver.valid(semver.coerce(raw)) };
}
