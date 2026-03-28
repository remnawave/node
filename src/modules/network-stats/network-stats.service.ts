import { existsSync, readFileSync } from 'node:fs';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { IInterfaceRate, IInterfaceStats, INetworkSnapshot } from './interfaces';

@Injectable()
export class NetworkStatsService implements OnModuleDestroy, OnModuleInit {
    private readonly logger = new Logger(NetworkStatsService.name);

    private readonly INTERVAL_MS = 1_000;

    private static readonly PROC_NET_DEV = '/proc/net/dev';
    private static readonly PROC_NET_ROUTE = '/proc/net/route';

    private isAvailable: boolean = false;
    private previousStats = new Map<string, IInterfaceStats>();
    private currentRates = new Map<string, IInterfaceRate>();
    private defaultIface: string | null = null;
    private timer: NodeJS.Timeout | null = null;
    private updatedAt: Date = new Date();

    constructor() {}

    onModuleInit(): void {
        const isAvailable = existsSync(NetworkStatsService.PROC_NET_DEV);
        if (!isAvailable) {
            this.logger.warn(
                `${NetworkStatsService.PROC_NET_DEV} not found — network stats polling disabled (non-Linux OS?)`,
            );
            return;
        } else {
            this.isAvailable = true;
        }

        this.defaultIface = this.resolveDefaultInterface();
        this.previousStats = this.readProcNetDev();
        this.updatedAt = new Date();

        this.timer = setInterval(() => this.tick(), this.INTERVAL_MS);

        this.logger.log(
            `Network stats polling started (interval: ${this.INTERVAL_MS}ms, default: ${this.defaultIface ?? 'unknown'})`,
        );
    }

    onModuleDestroy(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    getSnapshot(): INetworkSnapshot {
        return {
            isAvailable: this.isAvailable,
            interfaces: [...this.currentRates.values()],
            defaultInterface: this.defaultIface,
            updatedAt: this.updatedAt,
        };
    }

    getByInterface(name: string): IInterfaceRate | null {
        return this.currentRates.get(name) ?? null;
    }

    getDefault(): IInterfaceRate | null {
        if (!this.defaultIface) return null;
        return this.currentRates.get(this.defaultIface) ?? null;
    }

    getDefaultInterfaceName(): string | null {
        return this.defaultIface;
    }

    private tick(): void {
        try {
            const now = this.readProcNetDev();

            for (const [iface, current] of now) {
                const prev = this.previousStats.get(iface);
                if (!prev) continue;

                const elapsed = (current.timestamp - prev.timestamp) / 1_000;
                if (elapsed <= 0) continue;

                this.currentRates.set(iface, {
                    interface: iface,
                    rxBytesPerSec: Math.max(0, (current.rxBytes - prev.rxBytes) / elapsed),
                    txBytesPerSec: Math.max(0, (current.txBytes - prev.txBytes) / elapsed),
                    rxTotal: current.rxBytes,
                    txTotal: current.txBytes,
                });
            }

            this.previousStats = now;
            this.updatedAt = new Date();
        } catch (error) {
            this.logger.error('Failed to read network stats', error);
        }
    }

    private readProcNetDev(): Map<string, IInterfaceStats> {
        const result = new Map<string, IInterfaceStats>();
        const timestamp = Date.now();

        const content = readFileSync(NetworkStatsService.PROC_NET_DEV, 'utf-8');
        const lines = content.split('\n').slice(2).filter(Boolean);

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 10) continue;

            const iface = parts[0].replace(':', '');
            result.set(iface, {
                rxBytes: parseInt(parts[1], 10),
                txBytes: parseInt(parts[9], 10),
                timestamp,
            });
        }

        return result;
    }

    private resolveDefaultInterface(): string | null {
        try {
            if (!existsSync(NetworkStatsService.PROC_NET_ROUTE)) return null;

            const content = readFileSync(NetworkStatsService.PROC_NET_ROUTE, 'utf-8');
            const lines = content.split('\n').slice(1).filter(Boolean);
            const defaultRoute = lines.find((l) => l.split('\t')[1] === '00000000');
            return defaultRoute?.split('\t')[0] ?? null;
        } catch {
            this.logger.warn('Could not resolve default interface from /proc/net/route');
            return null;
        }
    }
}
