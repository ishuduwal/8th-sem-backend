import { Request, Response, NextFunction } from 'express';
import Discount, { IDiscount } from '../model/Discount';
import { checkAndUpdateDiscountStatus } from '../utils/Discount';

// Middleware to check discount status
export const checkDiscountStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        await checkAndUpdateDiscountStatus();
        next();
    } catch (error) {
        console.error('Error in checkDiscountStatus middleware:', error);
        next();
    }
};

export const createDiscount = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, percentage, startDate, endDate, applyTo, targetIds } = req.body;

        // Validation
        if (!name || !percentage || !startDate || !endDate || !applyTo) {
            res.status(400).json({ success: false, message: 'Required fields are missing' });
            return;
        }

        if (percentage < 1 || percentage > 100) {
            res.status(400).json({ success: false, message: 'Percentage must be between 1 and 100' });
            return;
        }

        if (startDate >= endDate) {
            res.status(400).json({ success: false, message: 'End date must be after start date' });
            return;
        }

        if (applyTo !== 'ALL' && (!targetIds || targetIds.length === 0)) {
            res.status(400).json({ 
                success: false, 
                message: 'Target IDs are required when applyTo is not ALL' 
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
            targetIds: applyTo === 'ALL' ? [] : targetIds
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
        const { name, description, percentage, startDate, endDate, isActive, applyTo, targetIds } = req.body;

        // Validation
        if (percentage && (percentage < 1 || percentage > 100)) {
            res.status(400).json({ success: false, message: 'Percentage must be between 1 and 100' });
            return;
        }

        if (startDate && endDate && startDate >= endDate) {
            res.status(400).json({ success: false, message: 'End date must be after start date' });
            return;
        }

        if (applyTo && applyTo !== 'ALL' && (!targetIds || targetIds.length === 0)) {
            res.status(400).json({ 
                success: false, 
                message: 'Target IDs are required when applyTo is not ALL' 
            });
            return;
        }

        const discount = await Discount.findByIdAndUpdate(
            id,
            {
                name,
                description,
                percentage,
                startDate,
                endDate,
                isActive,
                applyTo,
                targetIds: applyTo === 'ALL' ? [] : targetIds
            },
            { new: true, runValidators: true }
        );

        if (!discount) {
            res.status(404).json({ success: false, message: 'Discount not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Discount updated successfully',
            data: discount
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