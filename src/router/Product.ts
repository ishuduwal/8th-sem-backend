import express, { Router } from 'express';
import { multiUpload } from '../middleware/Upload';
import * as productController from '../controller/Product';

const productRouter = Router();

productRouter.post('/', multiUpload, productController.createProduct);
productRouter.get('/', productController.getAllProducts);
productRouter.get('/:id', productController.getProductById);
productRouter.put('/:id', multiUpload, productController.updateProduct);
productRouter.delete('/:id', productController.deleteProduct);
productRouter.get('/:id/recommendations', productController.recommendProducts);

export default productRouter;