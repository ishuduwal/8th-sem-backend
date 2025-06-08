import express from 'express';
import {
    createDiscount,
    getAllDiscounts,
    getDiscountById,
    updateDiscount,
    deleteDiscount,
    checkDiscountStatus
} from '../controller/Discount';

const discountRouter = express.Router();

// Apply the middleware to all discount routes
discountRouter.use(checkDiscountStatus);

discountRouter.post('/', createDiscount);
discountRouter.get('/', getAllDiscounts);
discountRouter.get('/:id', getDiscountById);
discountRouter.put('/:id', updateDiscount);
discountRouter.delete('/:id', deleteDiscount);

export default discountRouter;