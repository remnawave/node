export const HANDLER_CONTROLLER = 'handler' as const;

export const HANDLER_ROUTES = {
    REMOVE_USER: 'remove-user',
    ADD_USER: 'add-user',
    ADD_USERS: 'add-users',
    REMOVE_USERS: 'remove-users',

    DROP_USERS_CONNECTIONS: 'drop-users-connections',
    DROP_IPS: 'drop-ips',
} as const;
