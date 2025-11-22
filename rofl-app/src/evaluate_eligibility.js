#!/usr/bin/env node

// Input: objeto con { age, hasDiabetes, creatinine }
// Output: true / false
// Reglas de ejemplo para poc

function evaluateEligibility(input) {
    const { age, hasDiabetes, creatinine } = input;

    // 1) Edad entre 18 y 65
    if (typeof age !== "number" || age < 18 || age > 65) {
        return false;
    }

    // 2) No tener diabetes (regla dura de exclusión)
    if (hasDiabetes === true) {
        return false;
    }

    // 3) Creatinina menor o igual a 1.8 (ejemplo)
    if (typeof creatinine === "number" && creatinine > 1.8) {
        return false;
    }

    // Si pasó todas las reglas, es elegible
    return true;
}


// --- CLI simple CLI like usage ---

function printUsageAndExit() {
    console.error(
        "Uso: node eligibility.js '{\"age\": 50, \"hasDiabetes\": false, \"creatinine\": 1.2}'"
    );
    process.exit(1);
}

// Tomamos el JSON del segundo argumento
const arg = process.argv[2];
if (!arg) {
    printUsageAndExit();
}

let input;
try {
    input = JSON.parse(arg);
} catch (e) {
    console.error("Error: el argumento no es JSON válido.");
    printUsageAndExit();
}

const result = evaluateEligibility(input);
console.log(result ? "true" : "false");