/* ZeroCals math engine — safe tokenizer + recursive-descent parser.
 * No eval()/new Function(): only whitelisted functions and constants. */
(function (global) {
    'use strict';

    var FUNCTIONS = {
        sin: Math.sin, cos: Math.cos, tan: Math.tan,
        asin: Math.asin, acos: Math.acos, atan: Math.atan,
        log: Math.log10, ln: Math.log, sqrt: Math.sqrt
    };
    var CONSTANTS = {
        'π': Math.PI, pi: Math.PI, e: Math.E,
        'φ': (1 + Math.sqrt(5)) / 2, phi: (1 + Math.sqrt(5)) / 2,
        'τ': 2 * Math.PI, tau: 2 * Math.PI
    };
    var TRIG = { sin: 1, cos: 1, tan: 1 };
    var INV_TRIG = { asin: 1, acos: 1, atan: 1 };

    function ParseError(msg) { this.message = msg; }
    ParseError.prototype = Object.create(Error.prototype);

    function tokenize(src) {
        var tokens = [];
        var i = 0;
        while (i < src.length) {
            var ch = src[i];
            if (/\s/.test(ch)) { i++; continue; }

            if (/[0-9.]/.test(ch)) {
                var start = i;
                while (i < src.length && /[0-9.]/.test(src[i])) i++;
                // scientific notation: 1.5e-3, 2E5 (only when digits follow)
                if (src[i] === 'e' || src[i] === 'E') {
                    var j = i + 1;
                    if (src[j] === '+' || src[j] === '-') j++;
                    if (j < src.length && /[0-9]/.test(src[j])) {
                        i = j;
                        while (i < src.length && /[0-9]/.test(src[i])) i++;
                    }
                }
                var numStr = src.slice(start, i);
                if (!/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(numStr)) {
                    throw new ParseError('Bad number: ' + numStr);
                }
                tokens.push({ t: 'num', v: parseFloat(numStr) });
                continue;
            }

            if (/[a-zA-Z]/.test(ch) || ch === 'π' || ch === '√' || ch === 'φ' || ch === 'τ') {
                var start2 = i;
                while (i < src.length && /[a-zA-Z]/.test(src[i])) i++;
                if (i === start2) i++; // single non-ascii char (π, √)
                var word = src.slice(start2, i);
                if (ch === '√') word = 'sqrt';
                tokens.push({ t: 'id', v: word });
                continue;
            }

            if ('+-*/^%(),'.indexOf(ch) !== -1) {
                tokens.push({ t: ch });
                i++;
                continue;
            }

            throw new ParseError('Unexpected character: ' + ch);
        }
        tokens.push({ t: 'eof' });
        return tokens;
    }

    // Grammar:
    //   expr    := term (('+' | '-') term)*
    //   term    := power (('*' | '/') power)*
    //   unary   := ('-' | '+') unary | power
    //   power   := postfix ('^' unary)?        (right-associative)
    //   postfix := primary '%'*
    //   primary := number | constant | func '(' expr ')' | '(' expr ')'
    function parse(tokens) {
        var pos = 0;
        var peek = function () { return tokens[pos]; };
        var eat = function (t) {
            if (tokens[pos].t !== t) throw new ParseError('Expected ' + t);
            pos++;
        };

        function expr() {
            var left = term();
            while (peek().t === '+' || peek().t === '-') {
                var op = tokens[pos++].t;
                left = { t: 'bin', op: op, l: left, r: term() };
            }
            return left;
        }

        function term() {
            var left = unary();
            for (;;) {
                var t = peek().t;
                var op;
                if (t === '*' || t === '/') {
                    op = tokens[pos++].t;
                } else if (t === 'num' || t === 'id' || t === '(') {
                    op = '*'; // implicit multiplication: 2(3), 2sin(30), e2
                } else {
                    break;
                }
                left = { t: 'bin', op: op, l: left, r: unary() };
            }
            return left;
        }

        function unary() {
            if (peek().t === '-') { pos++; return { t: 'neg', arg: unary() }; }
            if (peek().t === '+') { pos++; return unary(); }
            return power();
        }

        function power() {
            var base = postfix();
            if (peek().t === '^') {
                pos++;
                return { t: 'bin', op: '^', l: base, r: unary() };
            }
            return base;
        }

        function postfix() {
            var node = primary();
            while (peek().t === '%') { pos++; node = { t: 'pct', arg: node }; }
            return node;
        }

        function primary() {
            var tok = peek();

            if (tok.t === 'num') { pos++; return { t: 'num', v: tok.v }; }

            if (tok.t === '(') {
                pos++;
                var inner = expr();
                eat(')');
                return inner;
            }

            if (tok.t === 'id') {
                var name = tok.v;
                pos++;
                if (name in CONSTANTS && peek().t !== '(') {
                    return { t: 'num', v: CONSTANTS[name] };
                }
                if (!(name in FUNCTIONS)) throw new ParseError('Unknown: ' + name);
                eat('(');
                var arg = expr();
                eat(')');
                return { t: 'call', name: name, arg: arg };
            }

            throw new ParseError('Unexpected token: ' + tok.t);
        }

        var ast = expr();
        if (peek().t !== 'eof') throw new ParseError('Unexpected trailing input');
        return ast;
    }

    // Eval returns { v, pct } where pct is the raw percent number for
    // percent nodes (enables "200 + 10%" => 220 like real calculators).
    function ev(node, deg) {
        switch (node.t) {
            case 'num': return { v: node.v, pct: null };
            case 'neg': {
                var n = ev(node.arg, deg);
                return { v: -n.v, pct: n.pct == null ? null : -n.pct };
            }
            case 'pct': {
                var p = ev(node.arg, deg);
                return { v: p.v / 100, pct: p.pct == null ? p.v : p.pct };
            }
            case 'call': {
                var raw = ev(node.arg, deg).v;
                var name = node.name;

                if (name in TRIG) {
                    var rad = deg ? raw * Math.PI / 180 : raw;
                    // tan() blows up at odd multiples of 90°
                    if (name === 'tan' && Math.abs(Math.cos(rad)) < 1e-11) {
                        return { v: Infinity, pct: null };
                    }
                    var tr = FUNCTIONS[name](rad);
                    // snap floating-point dust (sin(180°) => 0, not 1.2e-16)
                    if (Math.abs(tr) < 1e-12) tr = 0;
                    return { v: tr, pct: null };
                }
                if (name in INV_TRIG) {
                    var iv = FUNCTIONS[name](raw);
                    if (deg) iv *= 180 / Math.PI;
                    return { v: iv, pct: null };
                }
                return { v: FUNCTIONS[name](raw), pct: null };
            }
            case 'bin': {
                var l = ev(node.l, deg);
                var r = ev(node.r, deg);
                switch (node.op) {
                    case '+':
                        return { v: r.pct != null ? l.v + l.v * r.pct / 100 : l.v + r.v, pct: null };
                    case '-':
                        return { v: r.pct != null ? l.v - l.v * r.pct / 100 : l.v - r.v, pct: null };
                    case '*': return { v: l.v * r.v, pct: null };
                    case '/': return { v: l.v / r.v, pct: null };
                    case '^': return { v: Math.pow(l.v, r.v), pct: null };
                }
                break;
            }
        }
        throw new ParseError('Bad node');
    }

    function evaluate(src, degMode) {
        var ast = parse(tokenize(src));
        var out = ev(ast, degMode);
        return out.v;
    }

    global.ZeroMath = { evaluate: evaluate, ParseError: ParseError };
})(window);
