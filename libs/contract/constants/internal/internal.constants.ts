export const XRAY_INTERNAL_API_CONTROLLER = 'internal';
export const XRAY_INTERNAL_API_PATH = '/get-config';
export const XRAY_INTERNAL_FULL_PATH = `/${XRAY_INTERNAL_API_CONTROLLER}${XRAY_INTERNAL_API_PATH}`;
export function getXrayInternalApiSocketPath(rndStr: string): string {
    return `/run/remnawave-internal-${rndStr}.sock`;
}
