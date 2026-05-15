import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { ICommandResponse } from '@common/types/command-response.type';
import {
    ProbeFedarishaUserCommand,
    ProvisionFedarishaUserCommand,
    RevokeFedarishaUserCommand,
} from '@libs/contracts/commands';

import { InternalService } from '../internal/internal.service';
import { IPakStorage, PakService, PakUserAlreadyExistsError } from './pak.service';

interface IFedarishaInboundSettings {
    storage?: {
        type?: string;
        bucket?: string;
        endpoint?: string;
        region?: string;
        accessKey?: string;
        secretKey?: string;
    };
}

interface IXrayInbound {
    tag?: string;
    protocol?: string;
    settings?: IFedarishaInboundSettings;
}

@Injectable()
export class FedarishaPakService {
    private readonly logger = new Logger(FedarishaPakService.name);

    constructor(
        private readonly internalService: InternalService,
        private readonly pakService: PakService,
    ) {}

    public async provisionUser(
        body: ProvisionFedarishaUserCommand.Request,
    ): Promise<ICommandResponse<ProvisionFedarishaUserCommand.Response['response']>> {
        const storage = await this.resolveStorage(body.inboundTag);
        if (!storage) {
            return this.failProvision(`fedarisha inbound ${body.inboundTag} not found in xray config`);
        }

        try {
            const pakUserName = this.buildPakUserName(body.userUuid, body.inboundTag);
            const result = await this.createWithReclaim(storage, pakUserName, body.prefix);
            return {
                isOk: true,
                response: {
                    isOk: true,
                    accessKey: result.accessKey,
                    secretKey: result.secretKey,
                    error: null,
                },
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`provisionUser ${body.userUuid}: ${msg}`);
            return this.failProvision(msg);
        }
    }

    // Recovers from a stale orphan PAK on VK Cloud: when createKey returns
    // UserAlreadyExists, the panel forgot the secret (DB wipe / meta reset)
    // but the PAK is still bound to the user prefix on the bucket. Deleting
    // it and retrying create is safe — the same panel-side userUuid scopes
    // it to the same prefix, so we never overwrite another user's data.
    private async createWithReclaim(
        storage: IPakStorage,
        userName: string,
        prefix: string,
    ) {
        try {
            return await this.pakService.createKey(storage, userName, prefix);
        } catch (error) {
            if (!(error instanceof PakUserAlreadyExistsError)) throw error;
            this.logger.warn(
                `Reclaiming orphan PAK for user ${userName} on prefix ${prefix}`,
            );
            await this.pakService.deleteKey(storage, userName, prefix);
            return await this.pakService.createKey(storage, userName, prefix);
        }
    }

    public async revokeUser(
        body: RevokeFedarishaUserCommand.Request,
    ): Promise<ICommandResponse<RevokeFedarishaUserCommand.Response['response']>> {
        const storage = await this.resolveStorage(body.inboundTag);
        if (!storage) {
            return this.failRevoke(`fedarisha inbound ${body.inboundTag} not found in xray config`);
        }

        try {
            const pakUserName = this.buildPakUserName(body.userUuid, body.inboundTag);
            await this.pakService.deleteKey(storage, pakUserName, body.prefix);
            return { isOk: true, response: { isOk: true, error: null } };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`revokeUser ${body.userUuid}: ${msg}`);
            return this.failRevoke(msg);
        }
    }

    public async probeUser(
        body: ProbeFedarishaUserCommand.Request,
    ): Promise<ICommandResponse<ProbeFedarishaUserCommand.Response['response']>> {
        const storage = await this.resolveStorage(body.inboundTag);
        if (!storage) {
            return this.failProbe(
                `fedarisha inbound ${body.inboundTag} not found in xray config`,
            );
        }

        try {
            const exists = await this.pakService.probeKey(
                storage,
                body.accessKey,
                body.secretKey,
                body.prefix,
            );
            return { isOk: true, response: { isOk: true, exists, error: null } };
        } catch (error) {
            // Reaches here only on transport / unexpected status — panel will
            // keep the cached PAK rather than re-issue on infra hiccup.
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`probeUser ${body.userUuid}: ${msg}`);
            return this.failProbe(msg);
        }
    }

    // VK Cloud PAK usernames live in a per-master-account namespace, not per
    // bucket — two inbounds that share master credentials but write to
    // different buckets will collide on PUT (UserAlreadyExists) and the
    // subsequent DELETE on the second bucket returns 404 because the orphan
    // PAK is anchored to the first bucket. Disambiguate by hashing the
    // inboundTag into the PAK userName so each (user, inbound) pair claims a
    // distinct namespace entry.
    private buildPakUserName(userUuid: string, inboundTag: string): string {
        const tagHash = createHash('sha1').update(inboundTag).digest('hex').slice(0, 8);
        return `${userUuid}-${tagHash}`;
    }

    private async resolveStorage(inboundTag: string): Promise<IPakStorage | null> {
        const config = await this.internalService.getXrayConfig();
        const inbounds = (config?.inbounds as IXrayInbound[] | undefined) ?? [];
        const inbound = inbounds.find(
            (i) => i.tag === inboundTag && i.protocol === 'fedarisha',
        );
        const storage = inbound?.settings?.storage;
        if (!storage?.bucket || !storage.endpoint || !storage.accessKey || !storage.secretKey) {
            return null;
        }
        return {
            bucket: storage.bucket,
            endpoint: storage.endpoint,
            region: storage.region ?? '',
            accessKey: storage.accessKey,
            secretKey: storage.secretKey,
        };
    }

    private failProvision(
        error: string,
    ): ICommandResponse<ProvisionFedarishaUserCommand.Response['response']> {
        return {
            isOk: true,
            response: { isOk: false, accessKey: null, secretKey: null, error },
        };
    }

    private failRevoke(
        error: string,
    ): ICommandResponse<RevokeFedarishaUserCommand.Response['response']> {
        return { isOk: true, response: { isOk: false, error } };
    }

    private failProbe(
        error: string,
    ): ICommandResponse<ProbeFedarishaUserCommand.Response['response']> {
        return { isOk: true, response: { isOk: false, exists: false, error } };
    }
}
