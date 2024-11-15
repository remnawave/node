export const STATS_CONTROLLER = 'stats' as const;

export const STATS_ROUTES = {
    GET_USER_ONLINE_STATUS: 'get-user-online-status',
    GET_USERS_STATS: 'get-users-stats',
    GET_SYSTEM_STATS: 'get-system-stats',

    GET_INBOUND_STATS: 'get-inbound-stats',
    GET_OUTBOUND_STATS: 'get-outbound-stats',
} as const;
