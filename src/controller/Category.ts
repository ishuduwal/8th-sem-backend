import { Request, Response } from "express";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/Cloudinary";
import Category from "../model/Category";

const CLOUDINARY_FOLDER = 'categories';

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    let imageUrl;

    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer, CLOUDINARY_FOLDER);
    }

    const newCategory = new Category({
      name,
      description,
      image: imageUrl,
    });

    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ error: "Error creating category", details: error });
  }
};

export const getAllCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: "Error fetching categories" });
  }
};

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ error: "Error fetching category" });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    // Store old image URL for deletion if new image is uploaded
    let oldImageUrl: string | null = null;

    if (req.file) {
      if (category.image) {
        oldImageUrl = category.image;
      }
      const imageUrl = await uploadToCloudinary(req.file.buffer, CLOUDINARY_FOLDER);
      category.image = imageUrl;
    }

    category.name = name || category.name;
    category.description = description || category.description;

    const updatedCategory = await category.save();

    // Delete old image after successful update
    if (oldImageUrl) {
      try {
        await deleteFromCloudinary(oldImageUrl);
      } catch (error) {
        console.error('Error deleting old image:', error);
      }
    }

    res.status(200).json(updatedCategory);
  } catch (error) {
    res.status(500).json({ error: "Error updating category", details: error });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const imageUrl = category.image;

    await category.deleteOne();

    if (imageUrl) {
      try {
        await deleteFromCloudinary(imageUrl);
      } catch (error) {
        console.error('Error deleting image:', error);
      }
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting category", details: error });
  }
};