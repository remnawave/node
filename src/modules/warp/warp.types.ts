import type { TWarpStatus } from '@libs/contracts/models';

export type TWarpCommandResult = {
    stdout: string;
    stderr: string;
};

export type TWarpMutableStatus = TWarpStatus & {
    lastError: string | null;
};
