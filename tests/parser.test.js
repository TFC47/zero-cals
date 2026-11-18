/* ZeroCals parser test suite — run with: node tests/parser.test.js */
'use strict';

global.window = global;
require('../math-parser.js');
const { evaluate } = global.ZeroMath;

let passed = 0, failed = 0;

function eq(actual, expected, label) {
    const ok = typeof expected === 'number' && isFinite(expected)
        ? Math.abs(actual - expected) < 1e-9
        : Object.is(actual, expected);
    if (ok) { passed++; }
    else { failed++; console.log(`FAIL ${label}: got ${actual}, want ${expected}`); }
}

function throws(src, deg, label) {
    try {
        const v = evaluate(src, deg);
        failed++;
        console.log(`FAIL ${label}: expected error, got ${v}`);
    } catch (e) { passed++; }
}

const D = true, R = false;

// arithmetic & precedence
eq(evaluate('2+3*4', D), 14, 'precedence');
eq(evaluate('(2+3)*4', D), 20, 'parens');
eq(evaluate('10/4', D), 2.5, 'division');
eq(evaluate('2^3^2', D), 512, 'right assoc ^');
eq(evaluate('-2^2', D), -4, 'unary vs power');
eq(evaluate('2^-3', D), 0.125, 'negative exponent');
eq(evaluate('5+-3', D), 2, 'plus negative');
eq(evaluate('--5', D), 5, 'double neg');

// percent
eq(evaluate('200+10%', D), 220, 'percent of left (add)');
eq(evaluate('200-10%', D), 180, 'percent of left (sub)');
eq(evaluate('200*10%', D), 20, 'percent (mul)');
eq(evaluate('10%', D), 0.1, 'bare percent');
eq(evaluate('50+25%+5', D), 67.5, 'chained percent');

// trig — degrees
eq(evaluate('sin(30)', D), 0.5, 'sin 30deg');
eq(evaluate('cos(60)', D), 0.5, 'cos 60deg');
eq(evaluate('tan(45)', D), 1, 'tan 45deg');
eq(evaluate('asin(0.5)', D), 30, 'asin deg out');
eq(evaluate('sin(180)', D), 0, 'sin 180 snap');

// trig — radians
eq(evaluate('sin(π/2)', R), 1, 'sin pi/2 rad');
eq(evaluate('asin(1)', R), Math.PI / 2, 'asin rad out');

// tan asymptote — returns Infinity; the UI layer rejects non-finite results
eq(evaluate('tan(90)', D), Infinity, 'tan 90 = Infinity');

// functions & constants
eq(evaluate('log(100)', D), 2, 'log10');
eq(evaluate('ln(e)', D), 1, 'ln e');
eq(evaluate('√(9)+π', D), 3 + Math.PI, 'sqrt + pi');
eq(evaluate('e', D), Math.E, 'e constant');
eq(evaluate('φ', D), (1 + Math.sqrt(5)) / 2, 'phi');
eq(evaluate('τ', D), 2 * Math.PI, 'tau');
eq(evaluate('√(2)^2', D), 2, 'sqrt squared');

// scientific notation
eq(evaluate('1.5e-3', D), 0.0015, 'sci notation neg');
eq(evaluate('2E5', D), 200000, 'sci notation cap');
eq(evaluate('1.5e3+1', D), 1501, 'sci notation add');

// implicit multiplication
eq(evaluate('2(3)', D), 6, 'implicit mult parens');
eq(evaluate('2sin(30)', D), 1, 'implicit mult func');
eq(evaluate('e2', D), 2 * Math.E, 'implicit mult const');
eq(evaluate('(2+1)(3+1)', D), 12, 'implicit mult exprs');

// errors
throws('1.2.3', D, 'multi-dot number rejected');
throws('2..3', D, 'double dot rejected');
throws('sin()', D, 'empty args');
throws('1+', D, 'trailing operator');
throws('foo(1)', D, 'unknown function');
throws('', D, 'empty');
throws('(', D, 'open paren');
throws(')', D, 'close paren');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
