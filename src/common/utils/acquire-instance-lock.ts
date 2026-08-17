import net from 'node:net';

const INSTANCE_LOCK_SOCKET = '\0rwnode-lock' as const;

let _lockServer: net.Server | null = null;

export function acquireInstanceLock(): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.on('connection', (socket) => socket.destroy());

        server.on('error', (error: NodeJS.ErrnoException) => {
            resolve(error.code !== 'EADDRINUSE');
        });

        try {
            server.listen(INSTANCE_LOCK_SOCKET, () => {
                _lockServer = server;
                server.unref();

                resolve(true);
            });
        } catch {
            resolve(true);
        }
    });
}
