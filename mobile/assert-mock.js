// Mock del módulo 'assert' de Node.js para React Native / Metro
// Incluye .default para compatibilidad con módulos compilados con TypeScript/ESM
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.ok = assert;
assert.default = assert; // Para llamadas: assert_1.default(...)

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Assertion failed: ${actual} !== ${expected}`);
  }
};

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    throw new Error(message || `Assertion failed: values are strictly equal`);
  }
};

assert.equal = function equal(actual, expected, message) {
  // eslint-disable-next-line eqeqeq
  if (actual != expected) {
    throw new Error(message || `Assertion failed: ${actual} != ${expected}`);
  }
};

assert.notEqual = function notEqual(actual, expected, message) {
  // eslint-disable-next-line eqeqeq
  if (actual == expected) {
    throw new Error(message || `Assertion failed: ${actual} == ${expected}`);
  }
};

assert.throws = function throws(fn, _errType, message) {
  try { fn(); } catch (e) { return; }
  throw new Error(message || 'Expected function to throw');
};

assert.doesNotThrow = function doesNotThrow(fn, _errType, message) {
  try { fn(); } catch (e) {
    throw new Error(message || `Expected function not to throw, but it threw: ${e.message}`);
  }
};

assert.fail = function fail(message) {
  throw new Error(message || 'Assertion failed');
};

module.exports = assert;
