import { ISystemStats } from './get-system-stats.interface';
import si from 'systeminformation';
import prettyBytes from 'pretty-bytes';

export async function getSystemStats(): Promise<ISystemStats> {
    try {
        const cpuData = await si.cpu();
        const memoryData = await si.mem();

        return {
            cpuCores: cpuData.cores,
            cpuModel: `${cpuData.brand}/${cpuData.speed} GHz`,
            memoryTotal: prettyBytes(memoryData.total),
        };
    } catch (error) {
        return {
            cpuCores: 0,
            cpuModel: '',
            memoryTotal: '',
        };
    }
}
