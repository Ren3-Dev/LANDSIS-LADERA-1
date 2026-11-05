import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moisturePercent, formatMoisture } from '../src/moisture';
test('Referencias seco/agua, interpolación y ausencia de datos', () => {
  assert.equal(formatMoisture(4095), '0 %');
  assert.equal(formatMoisture(0), '100 %');
  assert.equal(moisturePercent(3276), 20);
  assert.equal(formatMoisture(2048), '50 %');
  for (const raw of [null, undefined, NaN, Infinity, -1, 4096, 1.5]) {
    assert.equal(moisturePercent(raw), null);
    assert.equal(formatMoisture(raw), 'Sin lectura');
  }
});
