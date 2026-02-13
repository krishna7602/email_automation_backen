const axios = require('axios');
const logger = require('../utils/logger');

class BusinessCentralService {
  constructor() {
    this.disabled = process.env.DISABLE_BC_SYNC === 'true';
    this.baseUrl = process.env.BC_API_URL || 'https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0';
    this.authConfig = {
      username: process.env.BC_USERNAME,
      password: process.env.BC_PASSWORD // Web Service Access Key for Basic Auth
    };
    this.companyId = process.env.BC_COMPANY_ID;
    this.defaultItemId = process.env.BC_DEFAULT_ITEM_ID || '1000'; // Default item if SKU mapping fails
    this.defaultGLAccount = process.env.BC_DEFAULT_GL_ACCOUNT || '8000'; // G/L Account for unmapped items
    this.maxRetries = parseInt(process.env.BC_MAX_RETRIES) || 3;
    this.retryDelay = parseInt(process.env.BC_RETRY_DELAY_MS) || 2000;
    
    if (this.disabled) {
      logger.info('⚠️  Business Central sync is DISABLED (DISABLE_BC_SYNC=true)');
    } else {
      logger.info('✅ Business Central sync is ENABLED', {
        baseUrl: this.baseUrl,
        username: this.authConfig.username ? '***' + this.authConfig.username.slice(-4) : 'NOT SET',
        companyId: this.companyId || 'AUTO-DETECT',
        maxRetries: this.maxRetries
      });
    }
  }

  get headers() {
    const auth = Buffer.from(`${this.authConfig.username}:${this.authConfig.password}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Validate BC configuration before attempting sync
   */
  validateConfig() {
    const errors = [];
    if (!this.authConfig.username) errors.push('BC_USERNAME is missing');
    if (!this.authConfig.password) errors.push('BC_PASSWORD is missing');
    if (!this.baseUrl) errors.push('BC_API_URL is missing');
    
    if (errors.length > 0) {
      throw new Error(`Business Central configuration incomplete: ${errors.join(', ')}`);
    }
    return true;
  }

  /**
   * Test connection and auto-detect company ID
   */
  async testConnection() {
    try {
      this.validateConfig();
      
      const url = `${this.baseUrl}/companies`;
      logger.info('Testing Business Central connection...', { url });
      
      const response = await axios.get(url, { 
        headers: this.headers,
        timeout: 10000 
      });
      
      logger.info('✅ Successfully connected to Business Central', {
        companiesFound: response.data.value?.length || 0
      });
      
      if (!this.companyId && response.data.value && response.data.value.length > 0) {
        this.companyId = response.data.value[0].id;
        const companyName = response.data.value[0].displayName || response.data.value[0].name;
        logger.info(`🏢 Auto-detected Company: "${companyName}" (ID: ${this.companyId})`);
        
        // Log all available companies for reference
        if (response.data.value.length > 1) {
          logger.info('📋 Available companies:', 
            response.data.value.map(c => ({ name: c.displayName || c.name, id: c.id }))
          );
        }
      }
      
      return {
        success: true,
        companyId: this.companyId,
        companies: response.data.value
      };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      const errorCode = err.response?.status;
      
      logger.error('❌ Business Central connection failed:', {
        error: errorMsg,
        statusCode: errorCode,
        url: err.config?.url
      });
      
      throw new Error(`BC Connection Failed (${errorCode}): ${errorMsg}`);
    }
  }

  /**
   * Sleep utility for retry delays
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Find or create customer in Business Central
   */
  async findOrCreateCustomer(orderData) {
    const customerName = orderData.customer?.company || orderData.customer?.name || 'Unknown Customer';
    const customerEmail = orderData.customer?.email;
    const customersUrl = `${this.baseUrl}/companies(${this.companyId})/customers`;
    
    try {
      // Try to find by displayName
      const filter = `displayName eq '${customerName.replace(/'/g, "''")}'`;
      const existingCustRes = await axios.get(
        `${customersUrl}?$filter=${encodeURIComponent(filter)}`, 
        { headers: this.headers, timeout: 10000 }
      );
      
      if (existingCustRes.data.value && existingCustRes.data.value.length > 0) {
        const customerId = existingCustRes.data.value[0].id;
        logger.info(`✅ Found existing customer: ${customerName}`, { customerId });
        return customerId;
      }
      
      // Customer not found, create new
      logger.info(`➕ Creating new customer: ${customerName}`);
      const newCustomerPayload = {
        displayName: customerName,
        email: customerEmail,
        phoneNumber: orderData.customer?.phone,
        addressLine1: orderData.customer?.address
      };
      
      const newCustRes = await axios.post(customersUrl, newCustomerPayload, { 
        headers: this.headers,
        timeout: 10000 
      });
      
      const customerId = newCustRes.data.id;
      logger.info(`✅ Customer created successfully`, { customerId, customerName });
      return customerId;
      
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      logger.error('❌ Customer creation/lookup failed:', { error: errorMsg, customerName });
      throw new Error(`Customer Error: ${errorMsg}`);
    }
  }

  /**
   * Create sales order header in Business Central
   */
  async createSalesOrderHeader(customerId, orderData) {
    const ordersUrl = `${this.baseUrl}/companies(${this.companyId})/salesOrders`;
    const orderPayload = {
      customerId: customerId,
      orderDate: (orderData.orderDate || new Date()).toISOString().split('T')[0],
      externalDocumentNumber: orderData.extractedOrderId || `EMAIL-${orderData.emailTrackingId || Date.now()}`
    };

    try {
      logger.info('📝 Creating sales order header...', { customerId, externalDoc: orderPayload.externalDocumentNumber });
      
      const orderRes = await axios.post(ordersUrl, orderPayload, { 
        headers: this.headers,
        timeout: 15000 
      });
      
      const bcOrder = orderRes.data;
      logger.info('✅ Sales order header created', { 
        bcOrderId: bcOrder.id, 
        bcOrderNumber: bcOrder.number 
      });
      
      return bcOrder;
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      logger.error('❌ Sales order header creation failed:', { error: errorMsg });
      throw new Error(`Order Header Error: ${errorMsg}`);
    }
  }

  /**
   * Add line items to sales order with intelligent fallback
   */
  async addOrderLines(bcOrderId, orderData) {
    const linesUrl = `${this.baseUrl}/companies(${this.companyId})/salesOrders(${bcOrderId})/salesOrderLines`;
    
    if (!orderData.items || orderData.items.length === 0) {
      logger.warn('⚠️  No items to add to order', { bcOrderId });
      return { success: 0, failed: 0, total: 0 };
    }

    let successCount = 0;
    let failedCount = 0;
    const failedItems = [];

    for (const [index, item] of orderData.items.entries()) {
      const itemNumber = index + 1;
      
      try {
        // Strategy 1: Try as Item with SKU
        const linePayload = {
          lineType: 'Item',
          lineObjectNumber: item.sku || this.defaultItemId,
          description: item.description.substring(0, 100), // BC has length limits
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0
        };
        
        logger.info(`📦 Adding line item ${itemNumber}/${orderData.items.length}`, { 
          description: item.description.substring(0, 50),
          sku: item.sku || 'DEFAULT',
          quantity: item.quantity 
        });
        
        await axios.post(linesUrl, linePayload, { 
          headers: this.headers,
          timeout: 10000 
        });
        
        successCount++;
        logger.info(`✅ Line item ${itemNumber} added successfully`);
        
      } catch (itemErr) {
        const errorMsg = itemErr.response?.data?.error?.message || itemErr.message;
        logger.warn(`⚠️  Item line failed for "${item.description}": ${errorMsg}`);
        
        // Strategy 2: Fallback to G/L Account
        try {
          logger.info(`🔄 Retrying as G/L Account line...`);
          const glLinePayload = {
            lineType: 'Account',
            lineObjectNumber: this.defaultGLAccount,
            description: `${item.description} (SKU: ${item.sku || 'N/A'})`.substring(0, 100),
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0
          };
          
          await axios.post(linesUrl, glLinePayload, { 
            headers: this.headers,
            timeout: 10000 
          });
          
          successCount++;
          logger.info(`✅ Line item ${itemNumber} added as G/L Account`);
          
        } catch (glErr) {
          const glErrorMsg = glErr.response?.data?.error?.message || glErr.message;
          logger.error(`❌ Both Item and G/L Account failed for line ${itemNumber}`, { 
            itemError: errorMsg,
            glError: glErrorMsg 
          });
          
          failedCount++;
          failedItems.push({
            item: item.description,
            error: glErrorMsg
          });
        }
      }
    }

    logger.info(`📊 Order lines summary`, { 
      total: orderData.items.length,
      success: successCount,
      failed: failedCount 
    });

    return { 
      success: successCount, 
      failed: failedCount, 
      total: orderData.items.length,
      failedItems 
    };
  }

  /**
   * Main sync method with retry logic
   */
  async syncOrder(orderData, force = false) {
    // 1. Skip if Business Central sync is disabled
    if (this.disabled) {
      logger.info('⏭️  Skipping Business Central sync (disabled)', { orderId: orderData._id });
      orderData.syncStatus = 'skipped';
      await orderData.save();
      return null;
    }

    // 2. Check if already synced
    if (orderData.syncStatus === 'synced' && orderData.businessCentralId && !force) {
      logger.info('✅ Order already synced to Business Central', { 
        orderId: orderData._id, 
        bcId: orderData.businessCentralId 
      });
      return orderData.businessCentralId;
    }

    let lastError = null;
    
    // 3. Retry loop with exponential backoff
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`🔄 Sync attempt ${attempt}/${this.maxRetries}`, { orderId: orderData._id });
        
        // Ensure we have company ID
        if (!this.companyId) {
          await this.testConnection();
        }

        // Step 1: Find or create customer
        const customerId = await this.findOrCreateCustomer(orderData);

        // Step 2: Create sales order header
        const bcOrder = await this.createSalesOrderHeader(customerId, orderData);
        const bcOrderId = bcOrder.id;

        // Step 3: Add line items
        const lineResult = await this.addOrderLines(bcOrderId, orderData);

        // Step 4: Update local order
        orderData.businessCentralId = bcOrderId;
        orderData.businessCentralOrderNumber = bcOrder.number;
        orderData.syncStatus = 'synced';
        orderData.syncError = null;
        orderData.syncedAt = new Date();
        orderData.syncAttempts = attempt;
        await orderData.save();

        logger.info('✅ Order successfully synced to Business Central', { 
          bcOrderId, 
          bcOrderNumber: bcOrder.number, 
          orderId: orderData._id,
          linesAdded: lineResult.success,
          linesFailed: lineResult.failed,
          attempts: attempt
        });
        
        return {
          bcOrderId,
          bcOrderNumber: bcOrder.number,
          linesAdded: lineResult.success,
          linesFailed: lineResult.failed,
          failedItems: lineResult.failedItems
        };

      } catch (err) {
        lastError = err;
        const errorMsg = err.message || 'Unknown error';
        
        logger.error(`❌ Sync attempt ${attempt}/${this.maxRetries} failed`, { 
          orderId: orderData._id,
          error: errorMsg 
        });

        // If this isn't the last attempt, wait before retrying
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          logger.info(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    const finalErrorMsg = lastError?.message || 'Unknown error after all retries';
    logger.error('❌ Business Central sync failed after all retries', { 
      orderId: orderData._id,
      attempts: this.maxRetries,
      error: finalErrorMsg 
    });
    
    orderData.syncStatus = 'failed';
    orderData.syncError = finalErrorMsg;
    orderData.syncAttempts = this.maxRetries;
    await orderData.save();
    
    throw new Error(`BC Sync Failed after ${this.maxRetries} attempts: ${finalErrorMsg}`);
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    try {
      const Order = require('../models/Order');
      const stats = await Order.aggregate([
        {
          $group: {
            _id: '$syncStatus',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        synced: 0,
        pending: 0,
        failed: 0,
        skipped: 0,
        total: 0
      };

      stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.total += stat.count;
      });

      return result;
    } catch (err) {
      logger.error('Error fetching sync stats:', err);
      return null;
    }
  }
}

module.exports = new BusinessCentralService();
