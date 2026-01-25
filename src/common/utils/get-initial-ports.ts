export function getSupervisordPort(): number {
    const port = process.env.SUPERVISORD_PORT;
    if (!port) return 61002;
    return parseInt(port, 10);
}

export function getInternalRestPort(): number {
    const port = process.env.INTERNAL_REST_PORT;
    if (!port) return 61001;
    return parseInt(port, 10);
}

export function getXtlsApiPort(): number {
    const port = process.env.XTLS_API_PORT;
    if (!port) return 61000;
    return parseInt(port, 10);
}
