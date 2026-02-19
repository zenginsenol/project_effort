import { expect, test } from '@playwright/test';

test('healthz page is reachable', async ({ request }) => {
  const response = await request.get('/healthz');
  expect(response.status()).toBe(200);
  await expect(response.text()).resolves.toContain('status: ok');
});
