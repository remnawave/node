export function canParseJSON(jsonString: string): boolean {
    try {
        JSON.parse(jsonString);
        return true;
    } catch {
        return false;
    }
}
