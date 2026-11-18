/* ZeroCals UI logic */
(function () {
    'use strict';

    var exprEl = document.getElementById('expr-line');
    var resultEl = document.getElementById('result-line');
    var angleBtn = document.getElementById('angle-btn');
    var historyBtn = document.getElementById('history-btn');
    var historyPanel = document.getElementById('history-panel');
    var historyList = document.getElementById('history-list');
    var clearHistoryBtn = document.getElementById('clear-history');
    var memoryBadge = document.getElementById('memory-badge');
    var angleBadge = document.getElementById('angle-badge');
    var soundBtn = document.getElementById('sound-btn');
    var basicBtn = document.getElementById('basic-btn');
    var sciBtn = document.getElementById('sci-btn');
    var extraRows = document.getElementById('extra-rows');
    var calcKeys = document.getElementById('calc-keys');
    var toast = document.getElementById('toast');

    var state = {
        expr: '',          // expression being edited
        lastExpr: '',      // last committed expression (for display line)
        lastResult: null,  // Ans value
        memory: 0,
        degMode: true,
        history: []
    };

    /* ---------- helpers ---------- */

    function formatResult(n) {
        if (Object.is(n, -0)) n = 0;
        if (!isFinite(n)) return 'Error';
        var abs = Math.abs(n);
        if (abs !== 0 && (abs >= 1e13 || abs < 1e-9)) {
            return n.toExponential(6).replace(/\.?0+e/, 'e');
        }
        // round to 10 decimal places, strip trailing zeros
        var rounded = Math.round(n * 1e10) / 1e10;
        return String(rounded);
    }

    function tryEval(src) {
        if (!src.trim()) return null;
        try {
            var v = ZeroMath.evaluate(src, state.degMode);
            return isFinite(v) ? v : null;
        } catch (e) {
            return null;
        }
    }

    /* ---------- display ---------- */

    // pretty symbols for display only (state.expr stays raw for the parser)
    function formatExpr(s) {
        return s.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
    }

    function refresh() {
        exprEl.textContent = formatExpr(state.expr || state.lastExpr || ' ');
        exprEl.classList.toggle('placeholder', !state.expr && !state.lastExpr);

        var preview = tryEval(state.expr);
        if (preview != null && state.expr) {
            resultEl.textContent = formatResult(preview);
            resultEl.classList.add('preview');
        } else if (state.expr) {
            resultEl.textContent = '…';
            resultEl.classList.add('preview');
        } else {
            resultEl.textContent = state.lastResult != null ? formatResult(state.lastResult) : '0';
            resultEl.classList.remove('preview');
        }
    }

    function flashError() {
        state.expr = '';
        resultEl.textContent = 'Error';
        resultEl.classList.remove('preview');
        resultEl.classList.remove('shake');
        void resultEl.offsetWidth; // restart animation
        resultEl.classList.add('shake');
        setTimeout(refresh, 1200);
    }

    /* ---------- actions ---------- */

    function insert(str) {
        // after "=", start a fresh expression unless inserting Ans
        state.expr += str;
        refresh();
    }

    function clearAll() {
        state.expr = '';
        state.lastExpr = '';
        state.lastResult = null;
        refresh();
    }

    function deleteLast() {
        state.expr = state.expr.slice(0, -1);
        refresh();
    }

    function currentValue() {
        if (state.expr.trim()) {
            var v = tryEval(state.expr);
            if (v != null) return v;
        }
        return state.lastResult != null ? state.lastResult : 0;
    }

    function equals() {
        var src = state.expr.trim();
        if (!src) return;

        var value;
        try {
            value = ZeroMath.evaluate(src, state.degMode);
        } catch (e) {
            flashError();
            return;
        }
        if (!isFinite(value)) { flashError(); return; }

        var rounded = Math.round(value * 1e10) / 1e10;
        state.lastResult = rounded;
        state.lastExpr = src;
        state.expr = '';

        pushHistory(src, rounded);
        refresh();

        // pop animation on the result
        resultEl.classList.remove('pop');
        void resultEl.offsetWidth;
        resultEl.classList.add('pop');
        setTimeout(function () { resultEl.classList.remove('pop'); }, 350);
    }

    function insertAns() {
        if (state.lastResult == null) return;
        insert('(' + formatResult(state.lastResult) + ')');
    }

    // ± — flip the sign of the last entered number / operator
    function negateLast() {
        var m = state.expr.match(/(\d+\.?\d*)$/);
        if (!m) return;
        var before = state.expr.slice(0, m.index);
        if (/\+\s*$/.test(before)) {
            state.expr = before.replace(/\+\s*$/, '-') + m[1];
        } else if (/-\s*$/.test(before)) {
            var nb = before.replace(/-\s*$/, '+');
            state.expr = (nb === '+' ? '' : nb) + m[1];
        } else {
            state.expr = before + '-' + m[1];
        }
        refresh();
    }

    /* ---------- memory ---------- */

    function memoryValue() {
        return state.memory;
    }

    function setMemoryBadge() {
        memoryBadge.hidden = state.memory === 0;
    }

    function memClear() { state.memory = 0; setMemoryBadge(); }
    function memRecall() { if (state.memory !== 0) insert(formatResult(state.memory)); }
    function memAdd() { state.memory += currentValue(); setMemoryBadge(); }
    function memSub() { state.memory -= currentValue(); setMemoryBadge(); }
    function memStore() { state.memory = currentValue(); setMemoryBadge(); }

    /* ---------- angle mode ---------- */

    function toggleAngle() {
        state.degMode = !state.degMode;
        angleBtn.textContent = state.degMode ? 'DEG' : 'RAD';
        angleBtn.classList.toggle('rad', !state.degMode);
        angleBadge.textContent = state.degMode ? 'DEG' : 'RAD';
        angleBadge.classList.toggle('rad', !state.degMode);
        refresh();
    }

    /* ---------- history ---------- */

    var HISTORY_KEY = 'zerocals-history';

    function loadHistory() {
        try {
            var h = JSON.parse(localStorage.getItem(HISTORY_KEY));
            state.history = Array.isArray(h) ? h : [];
        } catch (e) { state.history = []; }
    }

    function saveHistory() {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(-50)));
        } catch (e) { /* storage unavailable */ }
    }

    function pushHistory(expr, result) {
        state.history.push({ expr: expr, result: result });
        if (state.history.length > 50) state.history.shift();
        saveHistory();
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        if (!state.history.length) {
            var empty = document.createElement('div');
            empty.className = 'history-empty';
            empty.textContent = 'No calculations yet';
            historyList.appendChild(empty);
            return;
        }
        // newest first
        for (var i = state.history.length - 1; i >= 0; i--) {
            (function (entry) {
                var item = document.createElement('button');
                item.className = 'history-item';
                item.type = 'button';
                var e = document.createElement('span');
                e.className = 'h-expr';
                e.textContent = formatExpr(String(entry.expr));
                var r = document.createElement('span');
                r.className = 'h-result';
                r.textContent = '= ' + formatResult(entry.result);
                item.appendChild(e);
                item.appendChild(r);
                item.addEventListener('click', function () {
                    state.expr = entry.expr;
                    state.lastExpr = entry.expr;
                    refresh();
                    historyPanel.classList.remove('open');
                    historyBtn.classList.remove('active');
                });
                historyList.appendChild(item);
            })(state.history[i]);
        }
    }

    function toggleHistory() {
        var open = historyPanel.classList.toggle('open');
        historyBtn.classList.toggle('active', open);
    }

    clearHistoryBtn.addEventListener('click', function () {
        state.history = [];
        saveHistory();
        renderHistory();
    });
    historyBtn.addEventListener('click', toggleHistory);
    angleBtn.addEventListener('click', toggleAngle);

    /* ---------- keypad ---------- */

    calcKeys.addEventListener('click', function (e) {
        var btn = e.target.closest('.key');
        if (!btn) return;
        playClick();

        // press animation feedback (class is removed so it can't get stuck)
        btn.classList.remove('pressed');
        void btn.offsetWidth;
        btn.classList.add('pressed');
        setTimeout(function () { btn.classList.remove('pressed'); }, 200);

        if (btn.dataset.key !== undefined) {
            insert(btn.dataset.key);
            return;
        }
        switch (btn.dataset.action) {
            case 'clear': clearAll(); break;
            case 'del': deleteLast(); break;
            case 'equals': equals(); break;
            case 'mc': memClear(); break;
            case 'mr': memRecall(); break;
            case 'mplus': memAdd(); break;
            case 'mminus': memSub(); break;
            case 'ms': memStore(); break;
            case 'ans': insertAns(); break;
            case 'negate': negateLast(); break;
        }
    });

    /* ---------- keyboard ---------- */

    var KEY_MAP = {
        '*': '*', '/': '/', '-': '-', '+': '+', '^': '^', '%': '%',
        '(': '(', ')': ')', '.': '.', ',': '.'
    };

    document.addEventListener('keydown', function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        var k = e.key;
        var handled = true;

        if (k >= '0' && k <= '9') { insert(k); }
        else if (KEY_MAP[k] !== undefined) { insert(KEY_MAP[k]); }
        else if (k === 'Enter' || k === '=') { equals(); }
        else if (k === 'Backspace') { deleteLast(); }
        else if (k === 'Escape' || k === 'Delete') { clearAll(); }
        else if (k === 'p' || k === 'P') { insert('π'); }
        else if (k === 's' || k === 'S') { insert('√('); }
        else if (k === 'e' || k === 'E') { insert('e'); }
        else { handled = false; }

        if (handled) {
            playClick();
            e.preventDefault();
        }
    });

    /* ---------- sound ---------- */

    var SOUND_KEY = 'zerocals-sound';
    var soundOn = true;
    var audioCtx = null;
    try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) { }

    function playClick() {
        if (!soundOn) return;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            audioCtx = audioCtx || new AC();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            var t = audioCtx.currentTime;
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1500, t);
            osc.frequency.exponentialRampToValueAtTime(800, t + 0.05);
            gain.gain.setValueAtTime(0.035, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(t);
            osc.stop(t + 0.07);
        } catch (e) { }
    }

    soundBtn.addEventListener('click', function () {
        soundOn = !soundOn;
        soundBtn.classList.toggle('active', soundOn);
        soundBtn.setAttribute('aria-pressed', String(soundOn));
        try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch (e) { }
        playClick();
    });

    /* ---------- copy result ---------- */

    var toastTimer = null;
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1400);
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                showToast('Copied ' + text);
            }, function () {
                showToast('Copy failed');
            });
        } else {
            showToast('Copy unavailable');
        }
    }

    resultEl.addEventListener('click', function () {
        var t = resultEl.textContent.trim();
        if (!t || t === '…' || t === 'Error') return;
        var live = tryEval(state.expr);
        var out = live != null ? formatResult(live)
            : (state.lastResult != null ? formatResult(state.lastResult) : t);
        copyText(out);
    });

    /* ---------- basic / sci mode ---------- */

    function setSciMode(open) {
        extraRows.classList.toggle('open', open);
        sciBtn.classList.toggle('active', open);
        sciBtn.setAttribute('aria-pressed', String(open));
        basicBtn.classList.toggle('active', !open);
        basicBtn.setAttribute('aria-pressed', String(!open));
    }
    sciBtn.addEventListener('click', function () { setSciMode(true); });
    basicBtn.addEventListener('click', function () { setSciMode(false); });

    /* ---------- themes ---------- */

    var THEME_KEY = 'zerocals-theme';

    function applyTheme(name, persist) {
        document.body.className = name;
        document.querySelectorAll('[data-theme]').forEach(function (b) {
            b.classList.toggle('active', b.dataset.theme === name);
        });
        if (persist) {
            try { localStorage.setItem(THEME_KEY, name); } catch (e) { }
        }
    }

    document.querySelectorAll('[data-theme]').forEach(function (btn) {
        btn.addEventListener('click', function () { applyTheme(btn.dataset.theme, true); });
    });

    var savedTheme = null;
    try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { }
    var themes = ['light', 'dark', 'neon'];
    applyTheme(themes.indexOf(savedTheme) !== -1 ? savedTheme : 'light', false);

    /* ---------- init ---------- */

    loadHistory();
    renderHistory();
    setMemoryBadge();
    setSciMode(false);
    angleBadge.textContent = state.degMode ? 'DEG' : 'RAD';
    soundBtn.classList.toggle('active', soundOn);
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    resultEl.title = 'Click to copy result';
    refresh();

    // staggered key entrance animation
    var keys = calcKeys.querySelectorAll('.key');
    for (var i = 0; i < keys.length; i++) {
        keys[i].classList.add('enter');
        keys[i].style.animationDelay = (i * 14) + 'ms';
    }
})();
