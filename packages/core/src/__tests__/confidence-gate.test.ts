import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfidenceGate } from '../confidence-gate';

test('ConfidenceGate abstains when not measurable', () => {
  const gate = new ConfidenceGate({ minConfidence: 0.5, minPersistenceMs: 100 });
  const status = gate.evaluate({ measurable: false, confidence: 1, conditionMet: true, timestampMs: 0 });
  assert.equal(status, 'not_evaluated');
});

test('ConfidenceGate reports insufficient_data below the confidence threshold', () => {
  const gate = new ConfidenceGate({ minConfidence: 0.5, minPersistenceMs: 100 });
  const status = gate.evaluate({ measurable: true, confidence: 0.2, conditionMet: true, timestampMs: 0 });
  assert.equal(status, 'insufficient_data');
});

test('ConfidenceGate requires the condition to persist before reporting valid', () => {
  const gate = new ConfidenceGate({ minConfidence: 0.5, minPersistenceMs: 100 });
  assert.equal(gate.evaluate({ measurable: true, confidence: 1, conditionMet: true, timestampMs: 0 }), 'insufficient_data');
  assert.equal(gate.evaluate({ measurable: true, confidence: 1, conditionMet: true, timestampMs: 50 }), 'insufficient_data');
  assert.equal(gate.evaluate({ measurable: true, confidence: 1, conditionMet: true, timestampMs: 120 }), 'valid');
});

test('ConfidenceGate resets persistence when the condition drops', () => {
  const gate = new ConfidenceGate({ minConfidence: 0.5, minPersistenceMs: 100 });
  gate.evaluate({ measurable: true, confidence: 1, conditionMet: true, timestampMs: 0 });
  gate.evaluate({ measurable: true, confidence: 1, conditionMet: false, timestampMs: 50 });
  const status = gate.evaluate({ measurable: true, confidence: 1, conditionMet: true, timestampMs: 80 });
  assert.equal(status, 'insufficient_data', 'persistence clock should restart after the condition drops');
});

test('a single noisy frame cannot trigger valid even with high confidence', () => {
  const gate = new ConfidenceGate({ minConfidence: 0.5, minPersistenceMs: 200 });
  const status = gate.evaluate({ measurable: true, confidence: 1, conditionMet: true, timestampMs: 0 });
  assert.notEqual(status, 'valid');
});
