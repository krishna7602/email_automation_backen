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
        Analyze the provided email content (which may contain messy tables, forwarded threads, attachments text, or space-separated lines) and extract **EVERY VALID ORDER** as a distinct object.
        
        **⚠️ CRITICAL: EXHAUSTIVE EXTRACTION - READ THIS CAREFULLY ⚠️**
        You MUST extract **EVERY SINGLE ROW** from any table you find. 
        - If you see a table with 12 rows, you MUST create 12 separate item objects in the "items" array.
        - If you see a table with 50 rows, you MUST create 50 separate item objects.
        - DO NOT stop after the first few rows.
        - DO NOT summarize multiple rows into one item.
        - EACH ROW in a table = ONE ITEM in the items array.

        **INPUT TEXT:**
        """
        ${text.substring(0, 30000)} 
        """
        
        **CRITICAL PARSING RULES:**
        1. **IDENTIFY TABLES**: Look for repeating patterns, column headers (like Sr. No, Finished Good, Last Rate, Quantity Required, MRP), numbered rows (1, 2, 3...), or line-by-line lists.
        2. **EXTRACT EVERY ROW**: When you find a table structure:
           - Count the total number of data rows (excluding headers)
           - Create ONE item object for EACH row
           - Example: If rows are numbered 1-12, your items array MUST have 12 objects
        3. **SINGLE vs MULTIPLE ORDERS**:
           - **Scenario A (Multiple Orders)**: If different lines have different Customer Names, different Email Addresses, or explicit "Purchase Order Numbers" per line, treat them as separate orders.
           - **Scenario B (Single Order with Multiple Items)**: If all items seem to belong to the same customer/sender and share the same context, treat them as MANY items within a SINGLE order object. **THIS IS THE MOST COMMON CASE FOR TABLES.**
        4. **DO NOT SUMMARIZE**: Extract each line item separately with its own quantity and price.
        5. **COLUMN MAPPING**: Map table columns to item fields:
           - "Finished Good" / "Description" / "Item" → description
           - "Last Rate" / "Unit Price" / "Rate" / "Price" → unitPrice
           - "Quantity Required" / "Qty" / "Quantity" → quantity
           - "Sr. No" / "#" → can be used for ordering but not required

        **EXAMPLE: Table with 12 Items (ALL must be extracted)**
        Input:
        From: Ramkrishna Mondal <ramkrishnam170@gmail.com>
        
        Sr. No | Finished Good                              | Last Rate | Quantity Required
        1      | Heybuddie Dog Shampoo (500ml)             | 76.52     | 100
        2      | Heybuddie Dog Conditioner (500ml)         | 74.50     | 125
        3      | Heybuddie Dog Tick & Flea Shampoo (500ml) | 77.30     | 356
        4      | Heybuddie Pup Shampoo (500ml)             | 76.50     | 58
        5      | Heybuddie Pet Cologne (Citrus Paradise)   | 21.20     | 789
        6      | Heybuddie Pet Cologne (Lavender Dreams)   | 23.50     | 8897
        7      | Heybuddie Ticks Spray (200ml)             | 50.60     | 89
        8      | Heybuddie Paw Butter (100g)               | 53.00     | 65
        9      | Heybuddie Dog Shampoo (200ml)             | 31.80     | [blank]
        10     | Heybuddie Ear Cleaner (100 ml)            | 25.50     | 54
        11     | Heybuddie Foaming Paw Cleaner (150ml)     | 51.50     | 98
        12     | Heybuddie Omega 369 (200ml)               | 74.00     | 54
        
        Expected Output:
        {
          "orders": [
            {
              "extractedOrderId": "ORDER-001",
              "customer": { "name": "Ramkrishna Mondal", "email": "ramkrishnam170@gmail.com" },
              "items": [
                { "description": "Heybuddie Dog Shampoo (500ml)", "quantity": 100, "unitPrice": 76.52, "totalPrice": 7652.00 },
                { "description": "Heybuddie Dog Conditioner (500ml)", "quantity": 125, "unitPrice": 74.50, "totalPrice": 9312.50 },
                { "description": "Heybuddie Dog Tick & Flea Shampoo (500ml)", "quantity": 356, "unitPrice": 77.30, "totalPrice": 27518.80 },
                { "description": "Heybuddie Pup Shampoo (500ml)", "quantity": 58, "unitPrice": 76.50, "totalPrice": 4437.00 },
                { "description": "Heybuddie Pet Cologne (Citrus Paradise) (100ml)", "quantity": 789, "unitPrice": 21.20, "totalPrice": 16726.80 },
                { "description": "Heybuddie Pet Cologne (Lavender Dreams)(100ml)", "quantity": 8897, "unitPrice": 23.50, "totalPrice": 209079.50 },
                { "description": "Heybuddie Ticks Spray (200ml)", "quantity": 89, "unitPrice": 50.60, "totalPrice": 4503.40 },
                { "description": "Heybuddie Paw Butter (100g)", "quantity": 65, "unitPrice": 53.00, "totalPrice": 3445.00 },
                { "description": "Heybuddie Dog Shampoo (200ml)", "quantity": 0, "unitPrice": 31.80, "totalPrice": 0 },
                { "description": "Heybuddie Ear Cleaner (100 ml)", "quantity": 54, "unitPrice": 25.50, "totalPrice": 1377.00 },
                { "description": "Heybuddie Foaming Paw Cleaner (150ml)", "quantity": 98, "unitPrice": 51.50, "totalPrice": 5047.00 },
                { "description": "Heybuddie Omega 369 (200ml)", "quantity": 54, "unitPrice": 74.00, "totalPrice": 3996.00 }
              ],
              "totalAmount": 293095.00,
              "currency": "USD"
            }
          ]
        }

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
              "currency": "string (e.g. USD, INR)",
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
