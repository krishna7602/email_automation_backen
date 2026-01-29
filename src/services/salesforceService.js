const jsforce = require('jsforce');
const logger = require('../utils/logger');

class SalesforceService {
  constructor() {
    this.conn = null;
    this.username = process.env.SF_USERNAME;
    this.password = process.env.SF_PASSWORD;
    this.token = process.env.SF_TOKEN;
    this.loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
  }

  async connect() {
    try {
      if (this.conn) return this.conn;

      if (!this.username || !this.password) {
        throw new Error('Salesforce credentials missing in environment variables');
      }

      this.conn = new jsforce.Connection({
        loginUrl: this.loginUrl
      });

      await this.conn.login(this.username, this.password + (this.token || ''));
      logger.info('✅ Successfully connected to Salesforce');
      return this.conn;
    } catch (err) {
      logger.error('❌ Salesforce connection failed:', err.message);
      throw err;
    }
  }

  async syncOrder(orderData) {
    try {
      const conn = await this.connect();
      logger.info('Syncing order to Salesforce...', { orderId: orderData._id });

      // 1. Find or Create Account
      let accountId;
      const accountName = orderData.customer?.company || orderData.customer?.name || 'Unknown Account';
      
      const existingAccount = await conn.sobject('Account').findOne({ Name: accountName });
      if (existingAccount) {
        accountId = existingAccount.Id;
      } else {
        const newAcc = await conn.sobject('Account').create({
          Name: accountName,
          Phone: orderData.customer?.phone,
          BillingStreet: orderData.customer?.address
        });
        accountId = newAcc.id;
      }

      // 2. Create Order (Standard object)
      // Note: In standard Salesforce, Order requires a Pricebook2Id. 
      // We will try to find a standard pricebook first.
      let pricebookId;
      try {
        const pb = await conn.sobject('Pricebook2').findOne({ IsStandard: true });
        pricebookId = pb ? pb.Id : null;
      } catch (e) {
        logger.warn('Could not find Standard Pricebook');
      }

      const sfOrder = await conn.sobject('Order').create({
        AccountId: accountId,
        EffectiveDate: orderData.orderDate || new Date(),
        Status: 'Draft', // Default status
        Pricebook2Id: pricebookId,
        Description: `Extracted from email. Tracking ID: ${orderData.emailTrackingId}`,
        TotalAmount: orderData.totalAmount // Note: TotalAmount is often read-only in SF, calculated from items
      });

      // 3. Create Order Items (if products can be mapped)
      // For simplicity in this automated setup, we'll log the items in the order description 
      // or a custom field if we don't have Product2 references.
      // SF Order Items require PricebookEntryId which requires mapping "Product Name" to a SF Product.
      
      if (orderData.items && orderData.items.length > 0) {
        const itemsSummary = orderData.items.map(i => `${i.description} (Qty: ${i.quantity}, Price: ${i.unitPrice})`).join('\n');
        await conn.sobject('Order').update({
          Id: sfOrder.id,
          Description: `${sfOrder.Description || ''}\n\nITEMS:\n${itemsSummary}`
        });
      }

      // 4. Update local order with SF reference
      orderData.salesforceId = sfOrder.id;
      orderData.syncStatus = 'synced';
      await orderData.save();

      logger.info('✅ Order successfully synced to Salesforce', { sfOrderId: sfOrder.id });
      return sfOrder.id;
    } catch (err) {
      logger.error('❌ Salesforce sync failed:', err.message);
      orderData.syncStatus = 'failed';
      orderData.syncError = err.message;
      await orderData.save();
      throw err;
    }
  }
}

module.exports = new SalesforceService();
