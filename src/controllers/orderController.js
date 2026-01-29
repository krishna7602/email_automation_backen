const Order = require('../models/Order');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const logger = require('../utils/logger');

class OrderController {
  async getAllOrders(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const { status } = req.query;

      const query = {};
      if (status) query.status = status;

      const orders = await Order.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .populate('emailId', 'subject from receivedAt senderName');

      const total = await Order.countDocuments(query);

      return successResponse(res, {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching orders:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async getOrderById(req, res) {
    try {
      const order = await Order.findById(req.params.id).populate('emailId');
      if (!order) {
        return errorResponse(res, 'Order not found', 404);
      }
      return successResponse(res, order);
    } catch (error) {
      logger.error('Error fetching order:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async updateOrder(req, res) {
    try {
      const order = await Order.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      if (!order) {
        return errorResponse(res, 'Order not found', 404);
      }
      logger.info('Order updated', { orderId: order._id });
      return successResponse(res, order, 'Order updated successfully');
    } catch (error) {
      logger.error('Error updating order:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async deleteOrder(req, res) {
    try {
      const order = await Order.findByIdAndDelete(req.params.id);
      if (!order) {
        return errorResponse(res, 'Order not found', 404);
      }
      logger.info('Order deleted', { orderId: req.params.id });
      return successResponse(res, null, 'Order deleted successfully');
    } catch (error) {
      logger.error('Error deleting order:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async getOrderStats(req, res) {
    try {
      const stats = await Order.aggregate([
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            syncedOrders: {
              $sum: { $cond: [{ $eq: ['$syncStatus', 'synced'] }, 1, 0] }
            },
            pendingSync: {
              $sum: { $cond: [{ $eq: ['$syncStatus', 'pending'] }, 1, 0] }
            },
            avgConfidence: { $avg: '$aiConfidence' },
            totalRevenue: { $sum: '$totalAmount' }
          }
        }
      ]);

      const result = stats[0] || {
        totalOrders: 0,
        syncedOrders: 0,
        pendingSync: 0,
        avgConfidence: 0,
        totalRevenue: 0
      };

      delete result._id;
      return successResponse(res, result);
    } catch (error) {
      logger.error('Error fetching order stats:', error);
      return errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new OrderController();
