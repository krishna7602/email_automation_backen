const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function listModels() {
    try {
        const response = await axios.get(url);
        const models = response.data.models
            .filter(m => m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''));
            
        fs.writeFileSync('clean_models.json', JSON.stringify(models, null, 2));
    } catch (error) {
        fs.writeFileSync('clean_models.json', JSON.stringify({ error: error.message }));
    }
}

listModels();
