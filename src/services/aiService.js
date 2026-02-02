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
        Analyze the following email content and extract EVERY individual order item.
        
        Content:
        """
        ${text.substring(0, 30000)} 
        """
        
        CRITICAL PARSING RULES:
        1. This text often contains TABULAR data where each line represents a different Order and Customer.
        2. YOU MUST EXTRACT EVERY SINGLE ROW AS A SEPARATE INDEPENDENT ORDER.
        3. Do NOT merge rows. Do NOT summarize. Do NOT stop after the first item.
        4. Match these columns carefully: OrderID | CustomerName | Email | SKU | Quantity | Price | Total | Address
        
        DATA EXAMPLE (If you see this, extract 4 SEPARATE order objects):
        ORD-001 John Doe john@test.com WIDGET-A 5 10 50 123 Main St
        ORD-002 Jane Smith jane@test.com GADGET-B 1 150 150 456 Elm St
        ORD-003 Björn Borg bjorn@test.se RACKET-X 2 200 400 Storgatan 1
        ORD-004 Li Wei li.wei@test.cn TEA-SET 1 45.5 45.5 88 Nanjing Rd
        
        JSON STRUCTURE TO RETURN:
        Return an object with an "orders" array:
        {
          "orders": [
            {
              "extractedOrderId": "string",
              "customer": { 
                "name": "string",
                "email": "string",
                "address": "string"
              },
              "items": [
                 { "description": "string", "quantity": number, "unitPrice": number, "totalPrice": number, "sku": "string" }
              ],
              "totalAmount": number,
              "currency": "USD",
              "confidence": 1.0
            },
            ... (one per independent order found)
          ]
        }
        
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
      
      logger.info('Order extracted successfully with OpenAI', { 
        extractedItems: json.items?.length,
        totalAmount: json.totalAmount
      });
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
