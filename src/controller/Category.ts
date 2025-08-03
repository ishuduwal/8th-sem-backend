
import { Request, Response } from "express";
import { uploadToCloudinary } from "../utils/Cloudinary";
import Category from "../model/Category";


// Create Category
export const createCategory = async (req: Request, res: Response) => {
  try {
    console.log('Request body:', req.body);  // Add this line
    console.log('File:', req.file);     
    const { name, description } = req.body;
    let imageUrl;

    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer);
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

// Get All Categories
export const getAllCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: "Error fetching categories" });
  }
};

// Get Category by ID
export const getCategoryById = async (req: Request, res: Response) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(200).json(category);
};

// Update Category
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    if (req.file) {
      const imageUrl = await uploadToCloudinary(req.file.buffer);
      category.image = imageUrl;
    }

    category.name = name || category.name;
    category.description = description || category.description;

    await category.save();
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ error: "Error updating category", details: error });
  }
};

// Delete Category
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting category", details: error });
  }
};

