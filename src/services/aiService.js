const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      logger.warn('GEMINI_API_KEY is not set in .env. AI features will be disabled.');
    } else {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  async _generateWithFallback(prompt) {
    // Priority: Lite models usually have higher free-tier quotas (RPM/Daily)
    const models = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro',
      'gemini-pro'
    ];
    
    const maxRetries = 2;
    const baseDelay = 3000;

    for (const modelName of models) {
      let retries = 0;
      while (retries <= maxRetries) {
        try {
          const model = this.genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          return result;
        } catch (error) {
          const errorMessage = error.message || '';
          
          // Check for 403 Forbidden which often indicates daily quota fully exhausted
          if (errorMessage.includes('403') || errorMessage.includes('User Location is not supported')) {
            logger.warn(`Model ${modelName} access denied (403). Skipping...`);
            break; 
          }

          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            // Try with models/ prefix if not already present
            if (!modelName.startsWith('models/')) {
               logger.info(`Retrying ${modelName} with prefix models/...`);
               const prefixedModel = this.genAI.getGenerativeModel({ model: `models/${modelName}` });
               try {
                 return await prefixedModel.generateContent(prompt);
               } catch (innerErr) {
                 logger.warn(`Model models/${modelName} also failed or not found.`);
               }
            }
            logger.warn(`Model ${modelName} not found (404). Skipping...`);
            break; 
          }

          const isRateLimit = errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('Quota exceeded');
          
          if (isRateLimit) {
            // Check if it's the 20-request daily limit vs a temporary RPM limit
            if (errorMessage.includes('GenerateRequestsPerDayPerProjectPerModel') || errorMessage.includes('daily limit')) {
               logger.warn(`Model ${modelName} daily quota exhausted. Trying next model...`);
               break; 
            }

            if (retries < maxRetries) {
              retries++;
              const delay = baseDelay * Math.pow(2, retries);
              logger.warn(`Model ${modelName} RPM limited (429). Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue; 
            }
          }

          logger.warn(`Model ${modelName} failed`, { error: errorMessage });
          break; 
        }
      }
      
      if (modelName === models[models.length - 1]) {
        throw new Error('All AI models failed. Your daily quota might be fully exhausted.');
      }
    }
  }

  async extractOrderDetails(text) {
    if (!this.genAI) {
      throw new Error('AI extraction skipped: GEMINI_API_KEY missing.');
    }

    try {
      const prompt = `
        Act as an automated order entry system. 
        Analyze the following email content (body and attachment text) and extract order details.
        
        Content:
        """
        ${text.substring(0, 30000)} 
        """
        
        Return a valid JSON object with the following structure:
        {
          "extractedOrderId": "string or null",
          "customer": {
            "name": "string or null",
            "email": "string or null",
            "phone": "string or null",
            "address": "string or null",
            "company": "string or null"
          },
          "items": [
            {
              "description": "string",
              "quantity": number,
              "unitPrice": number,
              "totalPrice": number,
              "sku": "string or null"
            }
          ],
          "totalAmount": number,
          "currency": "string (e.g., USD, EUR)",
          "orderDate": "ISO date string or null",
          "confidence": number (0-1 score of how likely this is an order)
        }
        
        If this text does not appear to be an order, return {"confidence": 0}.
        Return ONLY the JSON. Do not include markdown formatting like \`\`\`json.
      `;

      const result = await this._generateWithFallback(prompt);
      const response = await result.response;
      let textResponse = response.text();

      // Clean up markdown code blocks if present
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('AI Response validation failed: No JSON found', { textResponse });
        return null;
      }

      const jsonString = jsonMatch[0];
      const json = JSON.parse(jsonString);
      return json;

    } catch (error) {
       if (error instanceof SyntaxError) {
          logger.error('AI JSON Parsing Failed', { error: error.message });
          return null; // Don't throw for simple parsing errors
       } else {
          logger.error('AI Extraction Failed', { error: error.message });
          throw error; // Throw for Quota, Network, etc.
       }
    }
  }
}

module.exports = new AIService();
