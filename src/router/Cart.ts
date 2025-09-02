import { Router } from 'express';
import * as cartController from '../controller/Cart';

const cartRouter = Router();

cartRouter.post('/add', cartController.addToCart);
cartRouter.get('/:userId', cartController.getCart);
cartRouter.put('/update', cartController.updateCartItem);
cartRouter.delete('/remove', cartController.removeFromCart);
cartRouter.delete('/clear/:userId', cartController.clearCart);
cartRouter.get('/count/:userId', cartController.getCartCount);

export default cartRouter;