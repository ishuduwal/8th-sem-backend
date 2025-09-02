import { Router } from 'express';
import * as orderController from '../controller/Order';

const orderRouter = Router();

// eSewa payment handlers 
orderRouter.get('/esewa/success', orderController.handleEsewaSuccess);
orderRouter.get('/esewa/failure', orderController.handleEsewaFailure);

// Order creation routes
orderRouter.post('/from-cart', orderController.createOrderFromCart);
orderRouter.post('/', orderController.createOrder); 

// Order retrieval routes
orderRouter.get('/user/:userId', orderController.getOrdersByUser);
orderRouter.get('/:orderId', orderController.getOrderById);
orderRouter.get('/:orderId/payment-status', orderController.checkPaymentStatus);
orderRouter.get('/', orderController.getAllOrders);

// Order update routes
orderRouter.put('/:orderId/status', orderController.updateOrderStatus);

// Order stats
orderRouter.get('/stats/:userId', orderController.getOrderStats);

export default orderRouter;