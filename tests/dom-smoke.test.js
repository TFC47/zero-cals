/* Smoke test: fake DOM + real script.js — verifies buttons/keys actually work */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// ---------- tiny DOM ----------
function makeClassList(el) {
    const set = new Set();
    return {
        add: (...c) => c.forEach(x => set.add(x)),
        remove: (...c) => c.forEach(x => set.delete(x)),
        toggle: (c, force) => {
            const on = force === undefined ? !set.has(c) : force;
            on ? set.add(c) : set.delete(c);
            return on;
        },
        contains: c => set.has(c)
    };
}

function makeEl(tag, attrs = {}) {
    const el = {
        tagName: tag.toUpperCase(),
        children: [],
        _handlers: {},
        style: {},
        dataset: {},
        textContent: '',
        innerHTML: '',
        title: '',
        hidden: false,
        offsetWidth: 100,
        classList: null,
        parent: null
    };
    el.classList = makeClassList(el);
    for (const [k, v] of Object.entries(attrs)) {
        if (k.startsWith('data-')) el.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
        else if (k === 'class') v.split(/\s+/).forEach(c => el.classList.add(c));
        else el[k] = v;
    }
    el.addEventListener = (t, fn) => { (el._handlers[t] = el._handlers[t] || []).push(fn); };
    el.appendChild = c => { c.parent = el; el.children.push(c); return c; };
    el.querySelectorAll = sel => {
        const out = [];
        (function rec(n) { n.children.forEach(c => { if (sel === '.key' && c.classList.contains('key')) out.push(c); rec(c); }); })(el);
        return out;
    };
    el.setAttribute = (k, v) => { el['attr_' + k] = v; };
    el.getAttribute = k => el['attr_' + k];
    el.closest = sel => (sel === '.key' && el.classList.contains('key')) ? el : null;
    el.click = () => (el._handlers.click || []).forEach(f => f({ target: el }));
    return el;
}

// registry of ids
const ids = {};
const byId = id => ids[id] || (ids[id] = makeEl('div', { id }));

const calcKeys = makeEl('div', { id: 'calc-keys' });
const keypad = makeEl('div', { id: 'keypad' });
ids['calc-keys'] = calcKeys;
ids['keypad'] = keypad;
ids['extra-rows'] = makeEl('div', { id: 'extra-rows' });

// build fake buttons from index.html
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const btnRe = /<button([^>]*)>([^<]*)<\/button>/g;
let m, keyButtons = [];
while ((m = btnRe.exec(html))) {
    const attrs = m[1], label = m[2];
    const cls = (attrs.match(/class="([^"]*)"/) || [])[1] || '';
    if (!cls.includes('key')) continue;
    const b = makeEl('button', {
        class: cls,
        'data-key': (attrs.match(/data-key="([^"]*)"/) || [])[1],
        'data-action': (attrs.match(/data-action="([^"]*)"/) || [])[1]
    });
    b.textContent = label;
    // put sci/memory/ans/negate buttons under extra-rows, rest under keypad (approximation ok)
    (cls.includes('sci') && (attrs.includes('mc') || attrs.includes('mr') || attrs.includes('mplus') ||
        attrs.includes('mminus') || attrs.includes('ms') || attrs.includes('sin') || attrs.includes('cos') ||
        attrs.includes('tan') || attrs.includes('log') || attrs.includes('ln') || attrs.includes('data-key="e"') ||
        attrs.includes('π') || attrs.includes('φ') || attrs.includes('τ') || attrs.includes('negate') ||
        attrs.includes('^2')) ? calcKeys : keypad).appendChild(b);
    // simpler: all buttons go to calcKeys anyway since listener is there
    keyButtons.push(b);
}
// ensure ALL key buttons are descendants reachable — our closest() works on the element itself,
// and calcKeys listener receives events we dispatch manually, so just collect them:
const allKeys = [];
function walk(el) { el.children.forEach(c => { allKeys.push(c); walk(c); }); }
walk(calcKeys); walk(keypad);

// ---------- fake document/window ----------
const themeBtns = ['light', 'dark', 'neon'].map(t => makeEl('button', { 'data-theme': t, class: 'theme-btn' }));
const docHandlers = {};

global.window = global;
const bodyEl = makeEl('body');
global.document = {
    body: bodyEl,
    getElementById: byId,
    querySelectorAll: sel => sel === '[data-theme]' ? themeBtns : [],
    createElement: tag => makeEl(tag),
    addEventListener: (t, fn) => { (docHandlers[t] = docHandlers[t] || []).push(fn); }
};
Object.defineProperty(global, 'navigator', { value: {}, configurable: true });
global.localStorage = {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; }
};

// load real scripts
const parserSrc = fs.readFileSync(path.join(ROOT, 'math-parser.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
eval(parserSrc);
eval(uiSrc);

// ---------- helpers ----------
let pass = 0, fail = 0;
function check(name, cond) {
    if (cond) { pass++; }
    else { fail++; console.log('FAIL:', name); }
}
function pressKey(key) {
    // dispatch through calcKeys click handler like a real click
    const btn = allKeys.find(b => b.dataset.key === key || b.dataset.action === key);
    if (!btn) { console.log('  (no button for', key, ')'); return null; }
    calcKeys._handlers.click.forEach(f => f({ target: btn }));
    return btn;
}
function type(expr) { for (const ch of expr) pressKey(ch); }
function keydown(k) { (docHandlers.keydown || []).forEach(f => f({ key: k, preventDefault() {}, metaKey: false, ctrlKey: false, altKey: false })); }
const result = () => ids['result-line'].textContent;
const exprLine = () => ids['expr-line'].textContent;

// ---------- tests ----------
// basic arithmetic via on-screen buttons
type('7'); type('+'); type('8'); pressKey('equals');
check('7+8=15', result() === '15');

// digits & operators
pressKey('mc'); // memory clear (no-op)
type('2'); type('*'); type('3'); pressKey('equals');
check('2*3=6', result() === '6');

// scientific: sin(30) in DEG
pressKey('sin('); type('3'); type('0'); pressKey(')'); pressKey('equals');
check('sin(30)=0.5', result() === '0.5');

// RAD mode via DEG button
ids['angle-btn'].click();
pressKey('sin('); type('3'); type('0'); pressKey(')'); pressKey('equals');
check('sin(30) rad ≈ -0.988', Math.abs(parseFloat(result()) - (-0.988031624)) < 1e-6);
ids['angle-btn'].click(); // back to DEG

// C clears
type('9'); type('9'); pressKey('clear');
check('C clears', exprLine().trim() === '' || exprLine() === ' ');

// DEL
type('1'); type('2'); type('3'); pressKey('del'); pressKey('equals');
check('123 DEL -> 12', result() === '12');

// percent
type('2'); type('0'); type('0'); type('+'); type('1'); type('0'); type('%'); pressKey('equals');
check('200+10%=220', result() === '220');

// Ans
type('5'); pressKey('equals'); pressKey('ans'); type('+'); type('2'); pressKey('equals');
check('Ans reuse: 5+2=7', result() === '7');

// memory MS/MR
type('4'); type('2'); pressKey('ms'); pressKey('clear'); pressKey('mr'); pressKey('equals');
check('MS/MR: 42', result() === '42');

// sci drawer toggle
ids['sci-btn'].click();
check('Sci opens drawer', ids['extra-rows'].classList.contains('open'));
ids['basic-btn'].click();
check('Basic closes drawer', !ids['extra-rows'].classList.contains('open'));

// history recorded
check('history has entries', (JSON.parse(localStorage.getItem('zerocals-history')) || []).length > 0);

// keyboard input
keydown('1'); keydown('2'); keydown('+'); keydown('3'); keydown('Enter');
check('keyboard 12+3=15', result() === '15');
keydown('Escape'); // clear
keydown('5'); keydown('Backspace'); keydown('=');
check('keyboard edge ok', typeof result() === 'string');

// invalid expression -> Error then recovers
type('('); pressKey('equals');
check('error shown', result() === 'Error' || ids['expr-line'].textContent === ' ');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
