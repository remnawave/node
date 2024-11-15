export const ROLE = {
    USER: 'user',
    ADMIN: 'admin',
} as const;

export type TRole = typeof ROLE;
export type TRolesKey = (typeof ROLE)[keyof typeof ROLE];
