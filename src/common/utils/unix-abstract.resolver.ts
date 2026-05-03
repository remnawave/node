import { experimental } from '@grpc/grpc-js';

export class AbstractUdsResolver implements experimental.Resolver {
    private endpoints: experimental.StatusOr<experimental.Endpoint[]>;
    private hasReturned = false;

    constructor(
        target: experimental.GrpcUri,
        private listener: experimental.ResolverListener,
    ) {
        const path = '\0' + target.path;
        this.endpoints = experimental.statusOrFromValue([{ addresses: [{ path }] }]);
    }

    updateResolution(): void {
        if (!this.hasReturned) {
            this.hasReturned = true;
            process.nextTick(() => {
                this.listener(this.endpoints, {}, null, '');
            });
        }
    }

    destroy() {
        this.hasReturned = false;
    }

    static getDefaultAuthority(): string {
        return 'localhost';
    }
}
