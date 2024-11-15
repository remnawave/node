export const ERRORS = {
    INTERNAL_SERVER_ERROR: { code: 'A001', message: 'Server error', httpCode: 500 },
    LOGIN_ERROR: { code: 'A002', message: 'Login error', httpCode: 500 },
    UNAUTHORIZED: { code: 'A003', message: 'Unauthorized', httpCode: 401 },
    FORBIDDEN_ROLE_ERROR: { code: 'A004', message: 'Forbidden role error', httpCode: 403 },
    CREATE_API_TOKEN_ERROR: { code: 'A005', message: 'Create API token error', httpCode: 500 },
    DELETE_API_TOKEN_ERROR: { code: 'A006', message: 'Delete API token error', httpCode: 500 },
    GET_XRAY_STATS_ERROR: {
        code: 'A009',
        message: 'Get Xray stats error',
        httpCode: 500,
    },
    FAILED_TO_GET_SYSTEM_STATS: {
        code: 'A010',
        message: 'Failed to get system stats',
        httpCode: 500,
    },
    FAILED_TO_GET_USERS_STATS: {
        code: 'A011',
        message: 'Failed to get users stats',
        httpCode: 500,
    },
    FAILED_TO_GET_INBOUND_STATS: {
        code: 'A012',
        message: 'Failed to get inbound stats',
        httpCode: 500,
    },
    FAILED_TO_GET_OUTBOUND_STATS: {
        code: 'A013',
        message: 'Failed to get outbound stats',
        httpCode: 500,
    },
} as const;
