const OpenAI = require('openai');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    if (!this.apiKey) {
      logger.warn('OPENAI_API_KEY is not set in .env. AI features will be disabled.');
    } else {
      this.openai = new OpenAI({
        apiKey: this.apiKey
      });
    }
  }

  async extractOrderDetails(text) {
    if (!this.openai) {
      throw new Error('AI extraction skipped: OPENAI_API_KEY missing.');
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
        
        CRITICAL: Ensure that the sum of (quantity * unitPrice) for all items exactly matches the totalAmount. If the email includes tax or shipping, include them as separate line items if possible, or ensure totalAmount reflects the full sum.
        
        Return ONLY the JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Efficient and high-quality for extraction
        messages: [
          { role: "system", content: "You are a specialized order extraction assistant. You always respond with valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // Keep it deterministic
      });

      const textResponse = response.choices[0].message.content;
      const json = JSON.parse(textResponse);
      
      logger.info('Order extracted successfully with OpenAI');
      return json;

    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.error('AI JSON Parsing Failed', { error: error.message });
        return null;
      } else {
        logger.error('OpenAI Extraction Failed', { 
          message: error.message,
          type: error.type,
          code: error.code,
          status: error.status
        });
        throw error;
      }
    }
  }
}

module.exports = new AIService();
