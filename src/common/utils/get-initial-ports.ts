export function getXtlsApiPort(): number {
    const port = process.env.XTLS_API_PORT;
    if (!port) return 61000;
    return parseInt(port, 10);
}
