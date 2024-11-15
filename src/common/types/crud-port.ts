export interface ICrud<ENTITY> {
    create: (entity: ENTITY) => Promise<ENTITY>;
    update: (entity: ENTITY) => Promise<ENTITY | null>;
    findByUUID: (uuid: string) => Promise<ENTITY | null>;
    findByCriteria: (entity: Partial<ENTITY>) => Promise<ENTITY[]>;
    deleteByUUID: (uuid: string) => Promise<boolean>;
}
