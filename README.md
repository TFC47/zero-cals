# ZeroCals ∑

A scientific calculator built with vanilla HTML, CSS, and JavaScript — no frameworks, no dependencies.

## Features

- **Scientific functions** — sin, cos, tan, sin⁻¹, cos⁻¹, tan⁻¹, log, ln, √, powers, π, e, φ, τ
- **DEG / RAD mode** — toggle with one click; badge shown inside the display; inverse trig respects the mode
- **Basic / Sci modes** — segmented toggle; sci drawer adds memory, trig, logs, constants, EXP, x², ±
- **Safe expression engine** — hand-written tokenizer + recursive-descent parser. No `eval()`, no `new Function()`
- **Real percent semantics** — `200 + 10%` → `220`, `200 × 10%` → `20`
- **Scientific notation** — `1.5e-3` works like a real calculator
- **Keyboard support** — full keyboard input with on-screen hints; `Enter` =, `Esc` = C, `⌫` = DEL, `P` = π, `S` = √, `E` = exponent
- **Key click sounds** — synthesized with Web Audio API (no audio files), toggleable
- **Live preview** — see the result as you type, with pretty × ÷ − symbols
- **History tape** — every calculation saved (localStorage), click to reuse; docked side panel on desktop, overlay drawer on mobile
- **Memory keys** — MC, MR, M+, M−, MS with on-screen indicator
- **Ans & ± keys** — reuse last result, flip signs
- **Click result to copy** — clipboard + toast confirmation
- **3 themes** — Light, Dark, Neon (persisted)
- **Fully responsive** — portrait layout on mobile, two-pane landscape on desktop, respects `prefers-reduced-motion`
- **Tested** — `node tests/parser.test.js` (38 assertions, zero deps)

## Run it

No build step. Either open `index.html` directly in a browser, or serve it:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Markup & keypad layout |
| `style.css` | Themes, layout, animations, responsive rules |
| `math-parser.js` | Tokenizer, parser, and evaluator (framework-free) |
| `script.js` | UI state, input handling, history, memory, keyboard |

## Why a custom parser?

The first version used `new Function()` to evaluate input. That works, but it executes arbitrary JavaScript and string-replacement hacks (`replace('e', 'Math.E')`) produced subtle bugs. The parser in `math-parser.js` only accepts numbers, whitelisted functions/constants, and operators — it's safer, testable, and handles edge cases like `-2^2 = -4`, `2^-3 = 0.125`, and `2^3^2 = 512` correctly.
