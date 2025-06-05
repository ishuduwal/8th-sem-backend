import { Request, Response } from 'express';
import Discount, { IDiscount } from '../model/Discount';
import Product from '../model/Product';
import Category from '../model/Category';

// Helper function to check and update discount status
const updateDiscountStatus = async (): Promise<void> => {
    const now = new Date();
    await Discount.updateMany(
        {
            $or: [
                { endDate: { $lt: now }, isActive: true },
                { startDate: { $gt: now }, isActive: false }
            ]
        },
        [
            {
                $set: {
                    isActive: {
                        $cond: {
                            if: { $lt: ['$endDate', now] },
                            then: false,
                            else: true
                        }
                    }
                }
            }
        ]
    );
};

// Middleware to update discount status before relevant operations
const checkDiscountStatus = async (req: Request, res: Response, next: Function): Promise<void> => {
    try {
        await updateDiscountStatus();
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating discount status',
            error: (error as Error).message
        });
    }
};

export const createDiscount = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, percentage, startDate, endDate, applyTo, targetIds } = req.body;

        // Validate required fields
        if (!name || !percentage || !startDate || !endDate || !applyTo) {
            res.status(400).json({ success: false, message: 'Required fields are missing' });
            return;
        }

        // Validate date range
        if (new Date(startDate) >= new Date(endDate)) {
            res.status(400).json({ success: false, message: 'End date must be after start date' });
            return;
        }

        // Validate percentage
        if (percentage <= 0 || percentage > 100) {
            res.status(400).json({ success: false, message: 'Percentage must be between 1 and 100' });
            return;
        }

        // Validate target IDs based on applyTo
        if (applyTo !== 'ALL' && (!targetIds || targetIds.length === 0)) {
            res.status(400).json({ success: false, message: 'Target IDs are required for this discount type' });
            return;
        }

        // Check if targets exist
        if (applyTo === 'CATEGORY') {
            const categories = await Category.find({ _id: { $in: targetIds } });
            if (categories.length !== targetIds.length) {
                res.status(400).json({ success: false, message: 'One or more categories not found' });
                return;
            }
        } else if (applyTo === 'PRODUCT') {
            const products = await Product.find({ _id: { $in: targetIds } });
            if (products.length !== targetIds.length) {
                res.status(400).json({ success: false, message: 'One or more products not found' });
                return;
            }
        }

        // Check for overlapping discounts
        const overlappingDiscounts = await Discount.find({
            $or: [
                { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) }
            ],
            applyTo,
            isActive: true
        });

        if (overlappingDiscounts.length > 0) {
            res.status(400).json({ 
                success: false, 
                message: 'Overlapping discounts exist for the same targets',
                data: overlappingDiscounts
            });
            return;
        }

        const discount = new Discount({
            name,
            description,
            percentage,
            startDate,
            endDate,
            applyTo,
            targetIds: applyTo === 'ALL' ? [] : targetIds,
            isActive: new Date(startDate) <= new Date()
        });

        await discount.save();

        res.status(201).json({
            success: true,
            message: 'Discount created successfully',
            data: discount
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error creating discount',
            error: error.message
        });
    }
};

export const getAllDiscounts = async (req: Request, res: Response): Promise<void> => {
    try {
        await updateDiscountStatus();
        
        const discounts = await Discount.find().sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            message: 'Discounts fetched successfully',
            data: discounts
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error fetching discounts',
            error: error.message
        });
    }
};

export const getDiscountById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const discount = await Discount.findById(id);

        if (!discount) {
            res.status(404).json({ success: false, message: 'Discount not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Discount fetched successfully',
            data: discount
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error fetching discount',
            error: error.message
        });
    }
};

export const updateDiscount = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description, percentage, startDate, endDate, applyTo, targetIds } = req.body;

        const existingDiscount = await Discount.findById(id);
        if (!existingDiscount) {
            res.status(404).json({ success: false, message: 'Discount not found' });
            return;
        }

        // Validate date range if provided
        if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
            res.status(400).json({ success: false, message: 'End date must be after start date' });
            return;
        }

        // Validate percentage if provided
        if (percentage && (percentage <= 0 || percentage > 100)) {
            res.status(400).json({ success: false, message: 'Percentage must be between 1 and 100' });
            return;
        }

        // Validate target IDs if applyTo is changed
        const newApplyTo = applyTo || existingDiscount.applyTo;
        if (newApplyTo !== 'ALL' && targetIds && targetIds.length === 0) {
            res.status(400).json({ success: false, message: 'Target IDs are required for this discount type' });
            return;
        }

        // Check if targets exist if changed
        if (newApplyTo === 'CATEGORY' && targetIds) {
            const categories = await Category.find({ _id: { $in: targetIds } });
            if (categories.length !== targetIds.length) {
                res.status(400).json({ success: false, message: 'One or more categories not found' });
                return;
            }
        } else if (newApplyTo === 'PRODUCT' && targetIds) {
            const products = await Product.find({ _id: { $in: targetIds } });
            if (products.length !== targetIds.length) {
                res.status(400).json({ success: false, message: 'One or more products not found' });
                return;
            }
        }

        const updatedDiscount = await Discount.findByIdAndUpdate(
            id,
            {
                name: name || existingDiscount.name,
                description: description !== undefined ? description : existingDiscount.description,
                percentage: percentage || existingDiscount.percentage,
                startDate: startDate || existingDiscount.startDate,
                endDate: endDate || existingDiscount.endDate,
                applyTo: newApplyTo,
                targetIds: applyTo === 'ALL' ? [] : (targetIds || existingDiscount.targetIds),
                isActive: existingDiscount.isActive // This will be updated by the status check
            },
            { new: true, runValidators: true }
        );

        // Update the status in case it changed
        await updateDiscountStatus();

        res.status(200).json({
            success: true,
            message: 'Discount updated successfully',
            data: updatedDiscount
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error updating discount',
            error: error.message
        });
    }
};

export const deleteDiscount = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const discount = await Discount.findByIdAndDelete(id);

        if (!discount) {
            res.status(404).json({ success: false, message: 'Discount not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Discount deleted successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error deleting discount',
            error: error.message
        });
    }
};

// Helper function to get applicable discounts for a product
export const getApplicableDiscounts = async (productId: string): Promise<IDiscount[]> => {
    const now = new Date();
    const product = await Product.findById(productId).populate('category');
    
    if (!product) {
        return [];
    }

    // Find all active discounts that apply to this product
    const discounts = await Discount.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [
            { applyTo: 'ALL' },
            { applyTo: 'CATEGORY', targetIds: product.category._id },
            { applyTo: 'PRODUCT', targetIds: product._id }
        ]
    }).sort({ percentage: -1 }); // Sort by highest percentage first

    return discounts;
};

// Function to calculate final price after applying all applicable discounts
export const calculateDiscountedPrice = async (productId: string, originalPrice: number): Promise<{ finalPrice: number; appliedDiscounts: IDiscount[] }> => {
    const discounts = await getApplicableDiscounts(productId);
    
    if (discounts.length === 0) {
        return { finalPrice: originalPrice, appliedDiscounts: [] };
    }

    // Apply the highest discount (they're already sorted by percentage)
    const highestDiscount = discounts[0];
    const finalPrice = originalPrice * (1 - highestDiscount.percentage / 100);

    return { 
        finalPrice: parseFloat(finalPrice.toFixed(2)), 
        appliedDiscounts: [highestDiscount] 
    };
};