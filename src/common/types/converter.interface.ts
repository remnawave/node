export interface IConverter<T, U> {
    fromPrismaModelToEntity(prismaModel: U): T;
    fromPrismaModelsToEntities(prismaModels: U[]): T[];
    fromEntityToPrismaModel(entity: T): U;
    fromEntitiesToPrismaModels(entities: T[]): U[];
}
