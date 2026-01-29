const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("API Key not found in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function checkModels() {
    try {
        // There isn't a direct "listModels" in the high-level SDK easily accessible for simple script 
        // without some setup, but we can try the most standard ones.
        
        const modelsToTest = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-001",
            "gemini-1.5-pro",
            "gemini-pro",
            "gemini-1.0-pro"
        ];

        console.log("Testing models with key beginning with: " + apiKey.substring(0, 5) + "...");

        for (const modelName of modelsToTest) {
            console.log(`\nTesting ${modelName}...`);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Test");
                console.log(`✅ ${modelName} SUCCESS:`, result.response.text().substring(0, 20));
                // If we find one that works, knowing which one is useful.
            } catch (error) {
                console.log(`❌ ${modelName} FAILED:`, error.message.split('\n')[0]);
            }
        }

    } catch (e) {
        console.error("Fatal script error:", e);
    }
}

checkModels();
