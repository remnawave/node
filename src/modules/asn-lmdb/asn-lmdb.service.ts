import { Database, open } from 'lmdb';
import { existsSync } from 'node:fs';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { IAsnPrefixes } from './interfaces';

@Injectable()
export class AsnLmdbService implements OnModuleDestroy, OnModuleInit {
    private readonly logger = new Logger(AsnLmdbService.name);

    private static readonly DB_PATH = '/usr/local/share/asn/asn-prefixes.lmdb';

    private db: Database<IAsnPrefixes, number> | null = null;
    private isAvailable: boolean = false;

    onModuleInit(): void {
        if (!existsSync(AsnLmdbService.DB_PATH)) {
            this.logger.warn(`${AsnLmdbService.DB_PATH} not found — ASN lookup disabled`);
            return;
        }

        try {
            this.db = open({
                path: AsnLmdbService.DB_PATH,
                encoding: 'msgpack',
                readOnly: true,
            });
            this.isAvailable = true;
            this.logger.log('ASN LMDB database opened successfully');
        } catch (error) {
            this.logger.error('Failed to open ASN LMDB database', error);
        }
    }

    onModuleDestroy(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.logger.log('ASN LMDB database closed');
        }
    }

    getIsAvailable(): boolean {
        return this.isAvailable;
    }

    getByAsn(asn: number): IAsnPrefixes | null {
        if (!this.isAvailable) return null;
        if (!this.db) return null;
        return this.db.get(asn) ?? null;
    }

    getIpv4ByAsn(asn: number): string[] {
        const entry = this.getByAsn(asn);
        if (!entry) return [];
        return entry.ipv4;
    }

    getIpv6ByAsn(asn: number): string[] {
        const entry = this.getByAsn(asn);
        if (!entry) return [];
        return entry.ipv6;
    }
}
