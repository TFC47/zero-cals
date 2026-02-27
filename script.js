const display = document.getElementById('display');
const degBtn = document.getElementById('deg-btn');

let isDegreeMode = true; 

function toggleDegRad() {
    isDegreeMode = !isDegreeMode;
    degBtn.innerText = isDegreeMode ? 'DEG' : 'RAD';
}

window.calcSin = (x) => {
    let radians = isDegreeMode ? x * (Math.PI / 180) : x;
    // Fixes JS floating point issue where sin(180) isn't exactly 0
    return Math.abs(Math.sin(radians)) < 1e-10 ? 0 : Math.sin(radians); 
};

window.calcCos = (x) => {
    let radians = isDegreeMode ? x * (Math.PI / 180) : x;
    return Math.abs(Math.cos(radians)) < 1e-10 ? 0 : Math.cos(radians);
};

window.calcTan = (x) => {
    let radians = isDegreeMode ? x * (Math.PI / 180) : x;
    if (Math.abs(Math.cos(radians)) < 1e-10) throw new Error("Infinity"); // Catches tan(90)
    return Math.abs(Math.tan(radians)) < 1e-10 ? 0 : Math.tan(radians);
};

// Inverse Trig (returns values in Degrees if in DEG mode)
window.calcAsin = (x) => {
    let result = Math.asin(x);
    return isDegreeMode ? result * (180 / Math.PI) : result;
};

window.calcAcos = (x) => {
    let result = Math.acos(x);
    return isDegreeMode ? result * (180 / Math.PI) : result;
};

window.calcAtan = (x) => {
    let result = Math.atan(x);
    return isDegreeMode ? result * (180 / Math.PI) : result;
};

function appendInput(value) {
    display.value += value;
}

function clearDisplay() {
    display.value = '';
}

function deleteLast() {
    display.value = display.value.slice(0, -1);
}

// Parses scientific notation into JS Math methods
function parseExpression(expr) {
    let parsed = expr;
    // Map Inverse Trig First (so 'asin' isn't accidentally caught by 'sin' replacement)
    parsed = parsed.replace(/asin\(/g, 'calcAsin(');
    parsed = parsed.replace(/acos\(/g, 'calcAcos(');
    parsed = parsed.replace(/atan\(/g, 'calcAtan(');
    
    // Map Regular Trig
    parsed = parsed.replace(/sin\(/g, 'calcSin(');
    parsed = parsed.replace(/cos\(/g, 'calcCos(');
    parsed = parsed.replace(/tan\(/g, 'calcTan(');
    
    // Map Constants and Logs
    parsed = parsed.replace(/log\(/g, 'Math.log10(');
    parsed = parsed.replace(/ln\(/g, 'Math.log(');
    parsed = parsed.replace(/π/g, 'Math.PI');
    parsed = parsed.replace(/e/g, 'Math.E');
    parsed = parsed.replace(/\^/g, '**'); 
    parsed = parsed.replace(/√\(/g, 'Math.sqrt(');
    return parsed;
}
function calculate() {
    if (display.value === '') return;

    try {
        const expressionToEvaluate = parseExpression(display.value);
        
        const result = new Function('return ' + expressionToEvaluate)();
        
        if (!isFinite(result) || isNaN(result)) {
            throw new Error('Invalid Math');
        }
        
        // Round to 8 decimal places for scientific precision while avoiding overflow
        display.value = Math.round(result * 100000000) / 100000000;
        
    } catch (error) {
        display.value = 'Syntax Error';
        display.style.color = '#ff0000'; 
        
        setTimeout(() => {
            display.value = '';
            display.style.color = ''; 
        }, 1500);
    }
}

function setTheme(themeName) {
    document.body.className = themeName;
}