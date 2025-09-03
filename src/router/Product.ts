import express, { Router } from 'express';
import { multiUpload } from '../middleware/Upload';
import * as productController from '../controller/Product';
import * as reviewController from '../controller/ProductRatingsComments';

const productRouter = Router();

productRouter.post('/', multiUpload, productController.createProduct);
productRouter.get('/', productController.getAllProducts);
productRouter.get('/:id', productController.getProductById);
productRouter.put('/:id', multiUpload, productController.updateProduct);
productRouter.delete('/:id', productController.deleteProduct);
productRouter.get('/:id/recommendations', productController.recommendProducts);

//  rating and comment routes
productRouter.post('/:productId/ratings', reviewController.addRating);
productRouter.post('/:productId/comments', reviewController.addComment);
productRouter.post('/:productId/comments/:commentId/replies', reviewController.addReply);
productRouter.post('/:productId/comments/:commentId/like', reviewController.likeComment);
productRouter.post('/:productId/comments/:commentId/replies/:replyId/like', reviewController.likeReply);
productRouter.delete('/:productId/comments/:commentId', reviewController.deleteComment);
productRouter.delete('/:productId/comments/:commentId/replies/:replyId', reviewController.deleteReply);
productRouter.get('/:productId/reviews', reviewController.getProductReviews);
productRouter.get('/featured/products', productController.getFeaturedProducts);

export default productRouter;