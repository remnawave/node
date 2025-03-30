import winston from 'winston';

const contextsToIgnore = ['InstanceLoader', 'RoutesResolver', 'RouterExplorer'];

export const customLogFilter = winston.format((info) => {
    if (info.context) {
        const contextValue = String(info.context);
        if (contextsToIgnore.some((ctx) => contextValue === ctx)) {
            return false;
        }
    }
    return info;
});
