import { IInterfaceRate } from './interface-rate.interface';

export interface INetworkSnapshot {
    isAvailable: boolean;
    interfaces: IInterfaceRate[];
    defaultInterface: string | null;
    updatedAt: Date;
}
