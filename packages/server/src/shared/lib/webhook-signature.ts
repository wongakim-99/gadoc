import { createHmac, timingSafeEqual } from 'node:crypto';

export function validWebhookSignature(rawBody: Buffer | undefined, secret: string, signature?: string) {
    if (!rawBody || !secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
