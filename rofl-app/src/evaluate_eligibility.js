#!/usr/bin/env node

const express = require('express');

// Input: objeto con { age, hasDiabetes, creatinine }
// Output: true / false
// Reglas de ejemplo para poc

function evaluateEligibility(input) {
    if (!input || !Array.isArray(input.item)) {
        return false;
    }

    const findSection = (linkId) => input.item.find((i) => i.linkId === linkId) || {};
    const findItem = (section, linkId) =>
        (section.item || []).find((i) => i.linkId === linkId) || {};

    const section1 = findSection("1");
    const section2 = findSection("2");
    const section3 = findSection("3");
    const section4 = findSection("4");

    const edadItem = findItem(section1, "1.1");
    const sexoItem = findItem(section1, "1.2");

    const dxPrevioItem = findItem(section2, "2.1");
    const sintomasItem = findItem(section2, "2.2");
    const pruebaCogItem = findItem(section2, "2.3");
    const puntajeItem = findItem(section2, "2.4");

    const antecedentesFamItem = findItem(section3, "3.1");
    const condicionesItem = findItem(section3, "3.2");
    const medicacionesItem = findItem(section3, "3.3");

    const ensayosItem = findItem(section4, "4.1");
    const acvConvItem = findItem(section4, "4.2");
    const otrasDemItem = findItem(section4, "4.3");

    const edad = edadItem.answer?.[0]?.valueInteger;
    const sexo = sexoItem.answer?.[0]?.valueString;
    const diagnosticoPrevio = dxPrevioItem.answer?.[0]?.valueString;
    const sintomas = (sintomasItem.answer || []).map((a) => a.valueString).filter(Boolean);
    const pruebaCognitivaReciente = pruebaCogItem.answer?.[0]?.valueString;
    const puntajePrueba = puntajeItem.answer?.[0]?.valueInteger;

    const antecedentesFamiliares = antecedentesFamItem.answer?.[0]?.valueString;
    const condicionesMedicas = (condicionesItem.answer || []).map((a) => a.valueString).filter(Boolean);
    const medicacionesActuales = (medicacionesItem.answer || []).map((a) => a.valueString).filter(Boolean);

    const participacionEnsayos = ensayosItem.answer?.[0]?.valueString;
    const antecedentesACVConvulsiones = acvConvItem.answer?.[0]?.valueString;
    const otrasDemencias = (otrasDemItem.answer || []).map((a) => a.valueString).filter(Boolean);

    // Regla 1: edad objetivo para Alzheimer temprano / MCI
    if (typeof edad !== "number" || edad < 55 || edad > 85) {
        return false;
    }

    // Regla 2: diagnóstico compatible
    const dxElegibles = [
        "Sí, Alzheimer",
        "Sí, Deterioro Cognitivo Leve",
        "No, pero presento síntomas",
    ];
    if (!dxElegibles.includes(diagnosticoPrevio)) {
        return false;
    }

    // Regla 3: al menos un síntoma relevante y no solo "Ninguno de los anteriores"
    if (!Array.isArray(sintomas) || sintomas.length === 0) {
        return false;
    }
    const soloNinguno =
        sintomas.length === 1 && sintomas[0] === "Ninguno de los anteriores";
    if (soloNinguno) {
        return false;
    }

    // Regla 4: prueba cognitiva (si hay puntaje, rango compatible)
    if (pruebaCognitivaReciente === "Sí, y tengo el resultado") {
        if (typeof puntajePrueba !== "number") {
            return false;
        }
        if (puntajePrueba < 18 || puntajePrueba > 30) {
            return false;
        }
    }

    // Regla 5: exclusiones duras

    // 5.1 Participación reciente en otros ensayos
    if (participacionEnsayos === "Sí") {
        return false;
    }

    // 5.2 Antecedentes de ACV o convulsiones
    if (antecedentesACVConvulsiones === "Sí") {
        return false;
    }

    // 5.3 Otras demencias distintas a Alzheimer
    const tieneOtraDemencia =
        Array.isArray(otrasDemencias) &&
        otrasDemencias.some((d) => d && d !== "No");
    if (tieneOtraDemencia) {
        return false;
    }

    // 5.4 Ejemplo de exclusión combinando comorbilidades/medicaciones
    const enfermedadCardiaca =
        Array.isArray(condicionesMedicas) &&
        condicionesMedicas.includes("Enfermedad cardíaca");
    const antipsicoticos =
        Array.isArray(medicacionesActuales) &&
        medicacionesActuales.includes("Antipsicóticos");
    if (enfermedadCardiaca && antipsicoticos) {
        return false;
    }

    // Si pasa todas las reglas, lo consideramos elegible para el ensayo
    return true;
}

// --- Servidor Express ---

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Endpoint POST para evaluar elegibilidad
app.post('/evaluateEligibility', (req, res) => {
    try {
        console.log('Evaluando elegibilidad...');
        const input = req.body;
        console.log('Input:', input);
        // Validar que el body tenga los campos necesarios
        if (!input || typeof input !== 'object') {
            return res.status(400).json({
                error: 'El cuerpo de la petición debe ser un objeto JSON válido'
            });
        }

        const result = evaluateEligibility(input);

        res.json({
            eligible: result
        });
        console.log('Elegibilidad evaluada:', result);
    } catch (error) {
        res.status(500).json({
            error: 'Error al procesar la solicitud',
            message: error.message
        });
    }
});

// Endpoint de salud
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor Express ejecutándose en el puerto ${PORT}`);
});