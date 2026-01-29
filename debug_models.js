const axios = require('axios');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API key found");
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function listModels() {
    try {
        console.log(`Fetching models from: ${url.replace(apiKey, 'HIDDEN_KEY')}`);
        const response = await axios.get(url);
        
        console.log("Response Status:", response.status);
        if (response.data && response.data.models) {
            console.log("\nAvailable Models:");
            response.data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                     console.log(`- ${m.name.replace('models/', '')}`);
                }
            });
        } else {
            console.log("No models found in response.");
        }

    } catch (error) {
        console.error("Error fetching models:");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

listModels();
