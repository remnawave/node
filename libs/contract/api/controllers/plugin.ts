export const PLUGIN_CONTROLLER = 'plugin' as const;

export const TORRENT_BLOCKER_ROUTE = 'torrent-blocker' as const;
export const NFTABLES_ROUTE = 'nftables' as const;

export const PLUGIN_ROUTES = {
    SYNC: 'sync',

    TORRENT_BLOCKER: {
        COLLECT: `${TORRENT_BLOCKER_ROUTE}/collect`,
    },
    NFTABLES: {
        UNBLOCK_IPS: `${NFTABLES_ROUTE}/unblock-ips`,
        BLOCK_IPS: `${NFTABLES_ROUTE}/block-ips`,
        RECREATE_TABLES: `${NFTABLES_ROUTE}/recreate-tables`,
    },
} as const;
