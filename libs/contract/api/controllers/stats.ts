export const STATS_CONTROLLER = 'stats' as const;

export const STATS_ROUTES = {
    GET_USER_ONLINE_STATUS: 'get-user-online-status',
    GET_USERS_STATS: 'get-users-stats',
    GET_SYSTEM_STATS: 'get-system-stats',

    GET_INBOUND_STATS: 'get-inbound-stats',
    GET_OUTBOUND_STATS: 'get-outbound-stats',

    GET_ALL_OUTBOUNDS_STATS: 'get-all-outbounds-stats',
    GET_ALL_INBOUNDS_STATS: 'get-all-inbounds-stats',

    GET_COMBINED_STATS: 'get-combined-stats',

    GET_USER_IP_LIST: 'get-user-ip-list',
} as const;
