import { Router } from 'express';
import * as orderController from '../controller/Order';

const orderRouter = Router();

orderRouter.post('/esewa/success', orderController.handleEsewaSuccess);
orderRouter.post('/esewa/failure', orderController.handleEsewaFailure);
orderRouter.post('/', orderController.createOrder);
orderRouter.get('/user/:email', orderController.getOrdersByUser);
orderRouter.get('/:orderId', orderController.getOrderById);
orderRouter.get('/:orderId/payment-status', orderController.checkPaymentStatus);
orderRouter.get('/', orderController.getAllOrders);
orderRouter.put('/:orderId/status', orderController.updateOrderStatus);

export default orderRouter;