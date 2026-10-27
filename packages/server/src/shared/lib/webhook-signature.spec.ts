import { createHmac } from 'node:crypto';
import { validWebhookSignature } from './webhook-signature';

it('verifies exact webhook bytes and rejects absent, malformed or changed signatures', () => {
    const body = Buffer.from('{ "message": "hello" }');
    const signature = `sha256=${createHmac('sha256', 'test-secret').update(body).digest('hex')}`;
    expect(validWebhookSignature(body, 'test-secret', signature)).toBe(true);
    expect(
        validWebhookSignature(Buffer.from(JSON.stringify(JSON.parse(body.toString()))), 'test-secret', signature),
    ).toBe(false);
    for (const bad of [undefined, 'sha256=ab', 'sha256=' + 'z'.repeat(64)])
        expect(validWebhookSignature(body, 'test-secret', bad)).toBe(false);
    expect(validWebhookSignature(undefined, 'test-secret', signature)).toBe(false);
});
