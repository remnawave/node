import { GetGeocheckCommand } from '@libs/contracts/commands';

type TGeocheckReport = GetGeocheckCommand.Response['response'];

export class GetGeocheckResponseModel {
    public readonly image: TGeocheckReport['image'];

    [key: string]: unknown;

    constructor(report: TGeocheckReport) {
        Object.assign(this, report);

        this.image = report.image;
    }
}
