import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProvider } from '../src/runner/provider-factory.js';

test('provider factory creates the requested provider without making a network call', () => {
  const provider = createProvider({ provider: 'openai', model: 'test-model', apiKey: 'test-key', fetchImpl: () => { throw new Error('not called'); } });
  assert.equal(provider.provider, 'openai');
  assert.equal(provider.model, 'test-model');
  assert.throws(() => createProvider({ provider: 'unknown', model: 'test-model', apiKey: 'test-key' }), /unsupported provider/i);
});
