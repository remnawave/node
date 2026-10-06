const WEBHOOK_TIMEOUT_MS = 5_000;

export function sendWebhook(url: string, body: unknown, onError?: (error: unknown) => void): void {
    fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    })
        .then((response) => {
            if (!response.ok) onError?.(new Error(`HTTP ${response.status}`));

            return response.body?.cancel();
        })
        .catch((error) => onError?.(error));
}
