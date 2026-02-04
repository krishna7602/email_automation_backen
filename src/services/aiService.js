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
        You are a highly precise Data Extraction Engine for an automated order processing system.
        
        **YOUR TASK:**
        Analyze the provided email content (which may contain messy tables, forwarded threads, attachments text, or space-separated lines) and extract **EVERY SINGLE VALID ORDER** as a distinct object.

        **INPUT TEXT:**
        """
        ${text.substring(0, 30000)} 
        """
        
        **CRITICAL PARSING RULES:**
        1. **ONE ROW = ONE ORDER**: In tabular data or lists, assume **EACH LINE** is a completely separate order unless it is clearly an itemized list for a *single* invoice.
        2. **CHECK FOR MULTIPLE EMAILS**: Scan the text. If you see multiple DIFFERENT email addresses (e.g. \`john@...\`, \`jane@...\`), you **MUST** split them into separate order objects in the \`orders\` array.
        3. **DO NOT MERGE**: If you see "ORD-001" and "ORD-002", these are TWO orders. Return 2 objects in the array.
        4. **Space-Separated Tables**: Parse lines like:
           \`ORD-001 | John | john@test.com | WIDGET | 5 | 50\`
           as a unique order.

        **SCENARIO HANDLING:**
        - **Scenario A (Bulk Report)**: You see a list of 4 people buying things. -> Return 4 separate Order objects.
        - **Scenario B (Single Invoice)**: You see one person buying 4 things. -> Return 1 Order object with 4 Items.

        **Your Data Interpretation Priority:**
        If you see **Order IDs** (ORD-001, ORD-002...) or **Different Names/Emails**, default to **Scenario A (Multiple Orders)**.
        
        **DATA EXAMPLE (If found, extract as separate orders):**
        Input:
        ORD-001 John Doe john@test.com WIDGET-A 5 10 50 123 Main St, NY
        ORD-002 Jane Smith jane@test.com GADGET-B 1 150 150 456 Elm St, CA
        
        Output:
        [
          { "extractedOrderId": "ORD-001", "customer": { "email": "john@test.com", ... } },
          { "extractedOrderId": "ORD-002", "customer": { "email": "jane@test.com", ... } }
        ]

        **OUTPUT SCHEMA (Strict JSON):**
        Return a JSON object containing an array named "orders".
        
        {
          "orders": [
            {
              "extractedOrderId": "string (or generate one if missing)",
              "customer": { 
                "name": "string (Customer Name)",
                "email": "string (Customer Email - CRITICAL IDENTIFIER)",
                "phone": "string (optional)",
                "address": "string (Shipping Address)",
                "company": "string (optional)"
              },
              "items": [
                 { 
                   "description": "string (Item Name/Description)",
                   "quantity": number,
                   "unitPrice": number, 
                   "totalPrice": number, 
                   "sku": "string (optional)"
                 }
              ],
              "totalAmount": number,
              "currency": "string (e.g. USD)",
              "orderDate": "string (ISO 8601, optional)",
              "confidence": number
            }
          ]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a specialized order extraction assistant that outputs only valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const textResponse = response.choices[0].message.content;
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const json = JSON.parse(cleanJson);
      
      const orderCount = json.orders ? json.orders.length : 0;
      logger.info(`AI Extraction Complete. Found ${orderCount} orders.`, { 
        ordersFound: orderCount,
        firstOrderId: json.orders?.[0]?.extractedOrderId,
        rawJsonPreview: JSON.stringify(json).substring(0, 200)
      });
      
      return json;

    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.error('AI JSON Parsing Failed', { error: error.message, fullResponse: error.response });
        return null;
      } else {
        logger.error('OpenAI Extraction Failed', { 
          message: error.message,
          type: error.type
        });
        throw error;
      }
    }
  }
}

module.exports = new AIService();
