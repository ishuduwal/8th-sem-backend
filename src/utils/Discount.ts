import Discount, { IDiscount } from '../model/Discount';
import Product from '../model/Product';
import mongoose from 'mongoose';

export const applyDiscountToProducts = async (discount: IDiscount): Promise<void> => {
    const now = new Date();
    
    // Only apply if discount is active and within date range
    if (!discount.isActive || discount.startDate > now || discount.endDate < now) {
        return;
    }

    let query: any = {};
    const update: any = {
        $set: {
            price: {
                $multiply: [
                    "$originalPrice",
                    { $subtract: [1, { $divide: [discount.percentage, 100] }] }
                ]
            }
        }
    };

    switch (discount.applyTo) {
        case 'ALL':
            // Apply to all products
            query = {};
            break;
        case 'CATEGORY':
            // Apply to specific categories
            query = { category: { $in: discount.targetIds } };
            break;
        case 'PRODUCT':
            // Apply to specific products
            query = { _id: { $in: discount.targetIds } };
            break;
    }

    await Product.updateMany(query, update);
};

export const removeDiscountFromProducts = async (discount: IDiscount): Promise<void> => {
    let query: any = {};
    
    switch (discount.applyTo) {
        case 'ALL':
            // Reset all products to original price
            query = {};
            break;
        case 'CATEGORY':
            // Reset products in these categories
            query = { category: { $in: discount.targetIds } };
            break;
        case 'PRODUCT':
            // Reset specific products
            query = { _id: { $in: discount.targetIds } };
            break;
    }

    await Product.updateMany(query, [
        { $set: { price: "$originalPrice" } }
    ]);
};

export const checkAndUpdateDiscountStatus = async (): Promise<void> => {
    const now = new Date();
    
    // Find all discounts that need to be deactivated
    const expiredDiscounts = await Discount.find({
        $or: [
            { endDate: { $lt: now }, isActive: true },
            { startDate: { $gt: now }, isActive: true }
        ]
    });

    // Deactivate expired discounts and remove their effects
    for (const discount of expiredDiscounts) {
        await removeDiscountFromProducts(discount);
        discount.isActive = false;
        await discount.save();
    }

    // Find all discounts that should be active
    const activeDiscounts = await Discount.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
    });

    // Apply active discounts
    for (const discount of activeDiscounts) {
        await applyDiscountToProducts(discount);
    }
};