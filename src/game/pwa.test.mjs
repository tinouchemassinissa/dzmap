import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('browser zoom remains enabled', () => {
  assert.equal(html.includes('user-scalable=no'), false);
  assert.equal(html.includes('maximum-scale=1.0'), false);
});

test('production page does not unregister its own service worker', () => {
  assert.equal(html.includes('getRegistrations()'), false);
  assert.equal(html.includes('registration.unregister()'), false);
});
