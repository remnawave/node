import type { AbuseBlockerReportModel } from '@libs/contracts/models';

export class AbuseBlockerReportsResponseModel {
    public reports: AbuseBlockerReportModel[];

    constructor(reports: AbuseBlockerReportModel[]) {
        this.reports = reports;
    }
}
