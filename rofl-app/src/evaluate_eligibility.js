#!/usr/bin/env node

const express = require('express');

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