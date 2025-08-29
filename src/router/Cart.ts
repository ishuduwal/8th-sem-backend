import { Router } from 'express';
import * as cartController from '../controller/Cart';

const cartRouter = Router();

cartRouter.post('/add', cartController.addToCart);
cartRouter.get('/:userEmail', cartController.getCart);
cartRouter.put('/update', cartController.updateCartItem);
cartRouter.delete('/remove', cartController.removeFromCart);
cartRouter.delete('/clear/:userEmail', cartController.clearCart);
cartRouter.get('/count/:userEmail', cartController.getCartCount);

export default cartRouter;