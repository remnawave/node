interface ITorrentBlockerReport {
    actionReport: {
        blocked: boolean;
        ip: string;
        blockDuration: number;
        willUnblockAt: Date;
        userId: string;
        processedAt: Date;
    };
    xrayReport: {
        email: string | null;
        level: number | null;
        protocol: string | null;
        network: string;
        source: string | null;
        destination: string;
        routeTarget: string | null;
        originalTarget: string | null;
        inboundTag: string | null;
        inboundName: string | null;
        inboundLocal: string | null;
        outboundTag: string | null;
        ts: number;
    };
}

export class TorrentBlockerReportsResponseModel {
    public reports: ITorrentBlockerReport[];

    constructor(reports: ITorrentBlockerReport[]) {
        this.reports = reports;
    }
}
