import { Request, Response } from 'express';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/Cloudinary';
import Product, { IProduct } from '../model/Product';
import mongoose from 'mongoose';

const CLOUDINARY_FOLDER = 'products';

// Type guard to check if files is the expected structure
const isMulterFiles = (files: any): files is { [fieldname: string]: Express.Multer.File[] } => {
  return files && typeof files === 'object' && !Array.isArray(files);
};

// delete multiple images
const deleteImages = async (imageUrls: string[]): Promise<void> => {
  for (const url of imageUrls) {
    if (url) {
      try {
        await deleteFromCloudinary(url);
      } catch (error) {
        console.error(`Error deleting image ${url}:`, error);
      }
    }
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, price, description, stock, category } = req.body;
    
    if (!req.files || !isMulterFiles(req.files) || !req.files.mainImage?.[0]) {
      res.status(400).json({ error: 'Main image is required' });
      return;
    }

    const mainImage = await uploadToCloudinary(
      req.files.mainImage[0].buffer,
      CLOUDINARY_FOLDER
    );

    const subImages: string[] = [];
    if (req.files.subImages) {
      for (const file of req.files.subImages) {
        const imageUrl = await uploadToCloudinary(file.buffer, CLOUDINARY_FOLDER);
        subImages.push(imageUrl);
      }
    }

    const newProduct = new Product({
      name,
      price: parseFloat(price),
      description,
      mainImage,
      subImages,
      stock: parseInt(stock),
      category: new mongoose.Types.ObjectId(category)
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Error creating product', details: error });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, price, description, stock, category } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Store old images for deletion if new images are uploaded
    let imagesToDelete: string[] = [];

    if (req.files && isMulterFiles(req.files) && req.files.mainImage?.[0]) {
      imagesToDelete.push(product.mainImage);
      product.mainImage = await uploadToCloudinary(
        req.files.mainImage[0].buffer, 
        CLOUDINARY_FOLDER
      );
    }

    if (req.files && isMulterFiles(req.files) && req.files.subImages) {
      if (product.subImages && product.subImages.length > 0) {
        imagesToDelete = [...imagesToDelete, ...product.subImages];
      }
      
      product.subImages = [];
      for (const file of req.files.subImages) {
        const imageUrl = await uploadToCloudinary(file.buffer, CLOUDINARY_FOLDER);
        product.subImages.push(imageUrl);
      }
    }

    if (name) product.name = name;
    if (price) product.price = parseFloat(price);
    if (description !== undefined) product.description = description;
    if (stock) product.stock = parseInt(stock);
    if (category) product.category = new mongoose.Types.ObjectId(category);

    const updatedProduct = await product.save();

    if (imagesToDelete.length > 0) {
      await deleteImages(imagesToDelete);
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: "Error updating product", details: error });
  }
};

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        const searchQuery = req.query.search 
            ? { name: { $regex: req.query.search as string, $options: 'i' } } 
            : {};

        const [products, total] = await Promise.all([
            Product.find(searchQuery)
                .populate('category', 'name')
                .skip(skip)
                .limit(limit),
            Product.countDocuments(searchQuery)
        ]);

        res.status(200).json({
            products,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ error: "Error fetching products" });
    }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
    try {
        const product = await Product.findById(req.params.id).populate('category', 'name');
        if (!product) {
            res.status(404).json({ error: "Product not found" });
            return;
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ error: "Error fetching product" });
    }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            res.status(404).json({ error: "Product not found" });
            return;
        }

        const imagesToDelete = [product.mainImage, ...(product.subImages || [])];

        await product.deleteOne();

        await deleteImages(imagesToDelete);

        res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error deleting product", details: error });
    }
};

export const recommendProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: "Invalid product ID" });
            return;
        }

        const targetProduct = await Product.findById(id)
            .select('name description category price mainImage');
            
        if (!targetProduct) {
            res.status(404).json({ message: "Product not found" });
            return;
        }

        if (!targetProduct.description || typeof targetProduct.description !== 'string') {
            res.status(400).json({ message: "Product description is required for recommendations" });
            return;
        }

        const products = await Product.find({
            _id: { $ne: id },
            description: { $exists: true, $ne: null, $type: 'string' }
        }).select('name description category price mainImage');

        const calculateSimilarityScore = (product: IProduct): number => {
            const categorySimilarity = targetProduct.category.equals(product.category) ? 1 : 0;

            const targetDescription = targetProduct.description.toLowerCase();
            const productDescription = product.description.toLowerCase();
            
            const targetWords = new Set(targetDescription.split(/\s+/));
            const productWords = new Set(productDescription.split(/\s+/));
            
            const sharedWords = [...targetWords].filter(word => 
                word && productWords.has(word)
            ).length;

            return sharedWords + categorySimilarity;
        };

        const recommendations = products
            .map(product => ({
                product: {
                    _id: product._id,
                    name: product.name,
                    price: product.price,
                    description: product.description,
                    mainImage: product.mainImage,
                    category: product.category
                },
                score: calculateSimilarityScore(product)
            }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score);

        res.status(200).json({
            message: "Recommendations generated successfully",
            recommendations: recommendations.slice(0, 5).map(rec => rec.product),
        });
    } catch (error) {
        console.error("Error generating recommendations:", error);
        res.status(500).json({ 
            message: "Error generating recommendations",
        });
    }
};