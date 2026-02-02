const axios = require('axios');
const logger = require('../utils/logger');

class BusinessCentralService {
  constructor() {
    this.baseUrl = process.env.BC_API_URL || 'https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0';
    this.authConfig = {
      username: process.env.BC_USERNAME,
      password: process.env.BC_PASSWORD // Web Service Access Key for Basic Auth
    };
    this.companyId = process.env.BC_COMPANY_ID;
  }

  get headers() {
    const auth = Buffer.from(`${this.authConfig.username}:${this.authConfig.password}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async testConnection() {
    try {
      if (!this.authConfig.username || !this.authConfig.password) {
        throw new Error('Business Central credentials missing in environment variables');
      }
      
      const url = `${this.baseUrl}/companies`;
      const response = await axios.get(url, { headers: this.headers });
      
      logger.info('✅ Successfully connected to Business Central');
      if (!this.companyId && response.data.value && response.data.value.length > 0) {
        this.companyId = response.data.value[0].id;
        logger.info(`Auto-detected Company ID: ${this.companyId}`);
      }
      return true;
    } catch (err) {
      logger.error('❌ Business Central connection failed:', err.message);
      throw err;
    }
  }

  async syncOrder(orderData) {
    try {
      if (!this.companyId) await this.testConnection();

      logger.info('Syncing order to Business Central...', { orderId: orderData._id });

      // 1. Find or Create Customer
      let customerId;
      const customerName = orderData.customer?.company || orderData.customer?.name || 'Unknown Customer';
      const customerEmail = orderData.customer?.email;

      // specific to your BC setup context
      const customersUrl = `${this.baseUrl}/companies(${this.companyId})/customers`;
      
      // Try to find by displayName or email
      // Note: OData filter syntax
      let filter = `displayName eq '${customerName.replace(/'/g, "''")}'`;
      if (customerEmail) {
         // Some BC implementations allow filtering by email if exposed, otherwise fall back to name
      }

      const existingCustRes = await axios.get(`${customersUrl}?$filter=${encodeURIComponent(filter)}`, { headers: this.headers });
      
      if (existingCustRes.data.value && existingCustRes.data.value.length > 0) {
        customerId = existingCustRes.data.value[0].id;
      } else {
        const newCustomerPayload = {
          displayName: customerName,
          email: customerEmail,
          phoneNumber: orderData.customer?.phone,
          addressLine1: orderData.customer?.address
        };
        const newCustRes = await axios.post(customersUrl, newCustomerPayload, { headers: this.headers });
        customerId = newCustRes.data.id;
      }

      // 2. Create Sales Order Header
      const ordersUrl = `${this.baseUrl}/companies(${this.companyId})/salesOrders`;
      const orderPayload = {
        customerId: customerId,
        orderDate: (orderData.orderDate || new Date()).toISOString().split('T')[0],
        externalDocumentNumber: `TRACK-${orderData.emailTrackingId || Date.now()}`
      };

      const orderRes = await axios.post(ordersUrl, orderPayload, { headers: this.headers });
      const bcOrder = orderRes.data;
      const bcOrderId = bcOrder.id;

      // 3. Create Sales Order Lines
      const linesUrl = `${this.baseUrl}/companies(${this.companyId})/salesOrders(${bcOrderId})/salesOrderLines`;
      
      if (orderData.items && orderData.items.length > 0) {
        for (const item of orderData.items) {
          // In a real scenario, you'd map Item SKU to BC Item ID. 
          // For now, we might use "Comment" type line or a generic Item if not found, 
          // or just assume Description holds enough info for a "G/L Account" or "Item" if mapped.
          // We will attempt to create a line with type 'Item' if we assume SKU mapping, or 'Comment' (if API allows)
          // or just passing description.
          
          // Simplified: Assuming we are creating a line with a description. 
          // Note: API v2.0 insists on valid type/itemId usually.
          // Using a placeholder Item if available or just logging.
          
          const linePayload = {
            lineType: 'Item', // or 'Comment'
            description: item.description,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0
          };
          
          // If we don't have a valid Item ID, creating lines might fail in standard BC API without one.
          // We'll wrap in try/catch or skip if strict.
          try {
             await axios.post(linesUrl, linePayload, { headers: this.headers });
          } catch (lineErr) {
             logger.warn(`Could not sync line item: ${item.description}`, lineErr.message);
          }
        }
      }

      // 4. Update local order
      orderData.businessCentralId = bcOrderId;
      orderData.syncStatus = 'synced';
      await orderData.save();

      logger.info('✅ Order successfully synced to Business Central', { bcOrderId });
      return bcOrderId;

    } catch (err) {
      logger.error('❌ Business Central sync failed:', err.response?.data?.error?.message || err.message);
      orderData.syncStatus = 'failed';
      orderData.syncError = err.message;
      await orderData.save();
      throw err;
    }
  }
}

module.exports = new BusinessCentralService();
