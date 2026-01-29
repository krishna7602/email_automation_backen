const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/stats', (req, res) => orderController.getOrderStats(req, res));
router.get('/', (req, res) => orderController.getAllOrders(req, res));
router.get('/:id', (req, res) => orderController.getOrderById(req, res));
router.put('/:id', (req, res) => orderController.updateOrder(req, res));
router.delete('/:id', (req, res) => orderController.deleteOrder(req, res));

module.exports = router;
