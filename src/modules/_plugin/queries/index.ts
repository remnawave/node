import { GetAbuseBlockerStateHandler } from './get-abuse-blocker-state';
import { GetAbuseBlockerStatsHandler } from './get-abuse-blocker-stats';
import { GetTorrentBlockerReportsCountHandler } from './get-torrent-blocker-reports-count';
import { GetTorrentBlockerStateHandler } from './get-torrent-blocker-state';

export const QUERIES = [
    GetAbuseBlockerStateHandler,
    GetAbuseBlockerStatsHandler,
    GetTorrentBlockerStateHandler,
    GetTorrentBlockerReportsCountHandler,
];
