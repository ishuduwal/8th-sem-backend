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
        
        // Build filter object
        const filter: any = {};
        
        // Search filter
        if (req.query.search) {
            filter.name = { $regex: req.query.search as string, $options: 'i' };
        }
        
        // Category filter
        if (req.query.category) {
            const categories = (req.query.category as string).split(',');
            const validCategories = categories.filter(cat => mongoose.Types.ObjectId.isValid(cat));
            if (validCategories.length > 0) {
                filter.category = { $in: validCategories.map(cat => new mongoose.Types.ObjectId(cat)) };
            }
        }
        
        // Price filter
        if (req.query.price) {
            const priceRange = req.query.price as string;
            const [min, max] = priceRange.split('-');
            
            if (min && max) {
                filter.price = { $gte: parseFloat(min), $lte: parseFloat(max) };
            } else if (min && !max) {
                filter.price = { $gte: parseFloat(min) };
            } else if (!min && max) {
                filter.price = { $lte: parseFloat(max) };
            }
        }

        // Build sort object
        let sortObj: any = {};
        const sortBy = req.query.sort as string;
        
        switch (sortBy) {
            case 'price-asc':
                sortObj = { price: 1 };
                break;
            case 'price-desc':
                sortObj = { price: -1 };
                break;
            case 'rating':
                sortObj = { averageRating: -1 };
                break;
            case 'name-asc':
                sortObj = { name: 1 };
                break;
            case 'name-desc':
                sortObj = { name: -1 };
                break;
            default: // newest
                sortObj = { createdAt: -1 };
                break;
        }

        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate('category', 'name')
                .sort(sortObj)
                .skip(skip)
                .limit(limit),
            Product.countDocuments(filter)
        ]);

        res.status(200).json({
            products,
            total,
            page,
            pages: Math.ceil(total / limit),
            filters: {
                category: req.query.category || '',
                price: req.query.price || '',
                sort: req.query.sort || 'newest',
                search: req.query.search || ''
            }
        });
    } catch (error) {
        console.error('Error fetching products:', error);
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

        // Validate product ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ 
                error: "Invalid product ID",
                message: "Please provide a valid product ID" 
            });
            return;
        }

        // Find the target product with proper error handling
        const targetProduct = await Product.findById(id)
            .select('name description category price mainImage');
            
        if (!targetProduct) {
            res.status(404).json({ 
                error: "Product not found",
                message: "The requested product does not exist" 
            });
            return;
        }

        // Validate that description exists and is a string
        if (!targetProduct.description || typeof targetProduct.description !== 'string' || targetProduct.description.trim().length === 0) {
            res.status(400).json({ 
                error: "Insufficient product data",
                message: "Product description is required for generating recommendations" 
            });
            return;
        }

        // Find other products with valid descriptions
        const products = await Product.find({
            _id: { $ne: id },
            description: { 
                $exists: true, 
                $ne: null, 
                $type: 'string',
                $regex: /[a-zA-Z0-9]/, // Ensure description has some content
            }
        }).select('name description category price mainImage');

        // If no other products found
        if (products.length === 0) {
            res.status(200).json({
                message: "No recommendations available",
                recommendations: []
            });
            return;
        }

        // Enhanced similarity calculation
        const calculateSimilarityScore = (product: IProduct): number => {
            let score = 0;

            // Category similarity (30% weight)
            if (targetProduct.category && product.category) {
                const categorySimilarity = targetProduct.category.equals(product.category) ? 3 : 0;
                score += categorySimilarity;
            }

            // Description similarity (70% weight)
            if (targetProduct.description && product.description) {
                const targetDescription = targetProduct.description.toLowerCase().trim();
                const productDescription = product.description.toLowerCase().trim();
                
                // Split into words and filter out common stop words
                const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
                
                const targetWords = new Set(
                    targetDescription.split(/\s+/)
                        .filter(word => word.length > 2 && !commonWords.has(word))
                );
                
                const productWords = new Set(
                    productDescription.split(/\s+/)
                        .filter(word => word.length > 2 && !commonWords.has(word))
                );

                // Calculate Jaccard similarity for better results
                const intersection = [...targetWords].filter(word => productWords.has(word)).length;
                const union = new Set([...targetWords, ...productWords]).size;
                
                const jaccardSimilarity = union > 0 ? intersection / union : 0;
                score += jaccardSimilarity * 7;
            }

            return parseFloat(score.toFixed(2));
        };

        // Calculate scores and filter
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
            .filter(item => item.score > 0) // Only include products with some similarity
            .sort((a, b) => b.score - a.score);

        // Handle case where no similar products found
        if (recommendations.length === 0) {
            // Fallback: return random products if no similar ones found
            const randomProducts = products
                .sort(() => Math.random() - 0.5)
                .slice(0, 5)
                .map(product => ({
                    _id: product._id,
                    name: product.name,
                    price: product.price,
                    description: product.description,
                    mainImage: product.mainImage,
                    category: product.category
                }));

            res.status(200).json({
                message: "No similar products found. Here are some random recommendations",
                recommendations: randomProducts,
                fallback: true
            });
            return;
        }

        // Return top recommendations
        res.status(200).json({
            message: "Recommendations generated successfully",
            recommendations: recommendations.slice(0, 5).map(rec => rec.product),
            totalFound: recommendations.length
        });

    } catch (error) {
        console.error("Error generating recommendations:", error);
        
        // More descriptive error response
        res.status(500).json({ 
            error: "Internal server error",
            message: "Failed to generate product recommendations",
        });
    }
};

export const getFeaturedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get top 8 products by average rating
    const featuredProducts = await Product.find({ 
      averageRating: { $exists: true, $gt: 0 } 
    })
      .sort({ averageRating: -1, createdAt: -1 })
      .limit(8)
      .populate('category', 'name');

    res.status(200).json(featuredProducts);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ error: "Error fetching featured products" });
  }
};

export const getSearchSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 5;

    console.log('Search suggestions request:', { query, limit });

    // Validate query parameter
    if (!query || query.trim().length < 2) {
      res.status(400).json({ 
        error: "Query parameter 'q' is required and must be at least 2 characters",
        suggestions: []
      });
      return;
    }

    const searchQuery = query.trim();

    // Simple aggregation that should work
    const suggestions = await Product.aggregate([
      {
        $match: {
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } }
          ],
          stock: { $gt: 0 }
        }
      },
      {
        $sort: { name: 1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          _id: { $toString: "$_id" }, // Convert ObjectId to string
          name: 1,
          price: 1,
          originalPrice: 1,
          mainImage: 1,
          stock: 1,
          category: 1
        }
      }
    ]);

    console.log('Search suggestions found:', suggestions.length);
    console.log('First suggestion:', suggestions[0]);

    res.status(200).json({
      suggestions: suggestions,
      query: searchQuery,
      total: suggestions.length
    });

  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    res.status(500).json({ 
      error: "Error fetching search suggestions",
      suggestions: []
    });
  }
};