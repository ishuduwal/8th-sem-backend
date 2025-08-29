import { Router } from 'express';
import * as orderController from '../controller/Order';

const orderRouter = Router();

orderRouter.post('/esewa/success', orderController.handleEsewaSuccess);
orderRouter.post('/esewa/failure', orderController.handleEsewaFailure);

// Order creation routes
orderRouter.post('/from-cart', orderController.createOrderFromCart); 
orderRouter.post('/', orderController.createOrder); 

// Order retrieval routes
orderRouter.get('/user/:email', orderController.getOrdersByUser);
orderRouter.get('/:orderId', orderController.getOrderById);
orderRouter.get('/:orderId/payment-status', orderController.checkPaymentStatus);
orderRouter.get('/', orderController.getAllOrders);

// Order update routes
orderRouter.put('/:orderId/status', orderController.updateOrderStatus);

orderRouter.get('/stats/:userEmail', orderController.getOrderStats);

export default orderRouter;