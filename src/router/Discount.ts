// routes/Discount.ts
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

// Apply discount status check middleware to relevant routes
discountRouter.use(checkDiscountStatus);

discountRouter.post('/', createDiscount);
discountRouter.get('/', getAllDiscounts);
discountRouter.get('/:id', getDiscountById);
discountRouter.put('/:id', updateDiscount);
discountRouter.delete('/:id', deleteDiscount);

export default discountRouter;