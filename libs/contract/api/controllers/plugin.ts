export const PLUGIN_CONTROLLER = 'plugin' as const;

export const TORRENT_BLOCKER_ROUTE = 'torrent-blocker' as const;

export const PLUGIN_ROUTES = {
    SYNC: 'sync',

    TORRENT_BLOCKER: {
        COLLECT: `${TORRENT_BLOCKER_ROUTE}/collect`,
    },
} as const;
