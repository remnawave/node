import type { TWarpStatus } from '@libs/contracts/models';

export type TWarpCommandResult = {
    stdout: string;
    stderr: string;
};

export type TWarpMutableStatus = {
    lastError: string | null;
} & TWarpStatus;
