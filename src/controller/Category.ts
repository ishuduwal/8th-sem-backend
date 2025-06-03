import { Request, Response } from 'express';
import Category, { ICategory } from '../model/Category';

export const createCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description } = req.body;

        if (!name) {
            res.status(400).json({ success: false, message: 'Category name is required' });
            return;
        }

        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            res.status(400).json({ success: false, message: 'Category already exists' });
            return;
        }

        const category = new Category({ name, description });
        await category.save();

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error creating category',
            error: error.message
        });
    }
};

export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            message: 'Categories fetched successfully',
            data: categories
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error fetching categories',
            error: error.message
        });
    }
};

export const getCategoryById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const category = await Category.findById(id);

        if (!category) {
            res.status(404).json({ success: false, message: 'Category not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Category fetched successfully',
            data: category
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error fetching category',
            error: error.message
        });
    }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if (name) {
            const existingCategory = await Category.findOne({ name, _id: { $ne: id } });
            if (existingCategory) {
                res.status(400).json({ success: false, message: 'Category name already exists' });
                return;
            }
        }

        const category = await Category.findByIdAndUpdate(
            id,
            { name, description },
            { new: true, runValidators: true }
        );

        if (!category) {
            res.status(404).json({ success: false, message: 'Category not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: category
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error updating category',
            error: error.message
        });
    }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const category = await Category.findByIdAndDelete(id);

        if (!category) {
            res.status(404).json({ success: false, message: 'Category not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error deleting category',
            error: error.message
        });
    }
};