export interface ICrud<ENTITY> {
    create: (entity: ENTITY) => Promise<ENTITY>;
    deleteByUUID: (uuid: string) => Promise<boolean>;
    findByCriteria: (entity: Partial<ENTITY>) => Promise<ENTITY[]>;
    findByUUID: (uuid: string) => Promise<ENTITY | null>;
    update: (entity: ENTITY) => Promise<ENTITY | null>;
}
