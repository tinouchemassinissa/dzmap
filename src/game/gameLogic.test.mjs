import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMultipleChoice, isAnswerCorrect, sanitizePlayerName } from '../gameLogic.js';

const data = {
  A: { capital: 'Cap A', region: 'East', code: 1 },
  B: { capital: 'Cap B', region: 'West', code: 2 },
  C: { capital: 'Cap C', region: 'South', code: 3 },
  D: { capital: 'Cap D', region: 'North', code: 4 },
  E: { capital: 'Cap E', region: 'East', code: 5 },
};

test('trivia validates the trivia value rather than the wilaya name', () => {
  assert.equal(isAnswerCorrect({ mode: 'TRIVIA', guess: 'Cap A', targetWilaya: 'A', triviaCorrectAnswer: 'Cap A' }), true);
  assert.equal(isAnswerCorrect({ mode: 'TRIVIA', guess: 'A', targetWilaya: 'A', triviaCorrectAnswer: 'Cap A' }), false);
});

test('region multiple choice terminates and contains unique options', () => {
  const options = generateMultipleChoice('East', 'region', data, Object.keys(data), () => 0.42);
  assert.ok(options.includes('East'));
  assert.equal(new Set(options).size, options.length);
  assert.ok(options.length >= 4 || new Set(Object.values(data).map((x) => x.region)).size < 4);
});

test('player names are sanitized and length-limited', () => {
  assert.equal(sanitizePlayerName('  <b>Amine</b>  '), 'bAmine/b');
  assert.equal(sanitizePlayerName(''), 'Explorer');
  assert.ok(sanitizePlayerName('x'.repeat(100)).length <= 24);
});
