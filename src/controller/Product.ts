import { Request, Response } from 'express';
import Product, { IProduct } from '../model/Product';
import Category from '../model/Category';
import cloudinary from '../config/Cloudinary';

// extract public ID from Cloudinary URL
const getPublicIdFromUrl = (url: string): string => {
    const matches = url.match(/upload\/(?:v\d+\/)?([^\.]+)/);
    return matches ? matches[1] : '';
};

// remove image from  coludinary 
const deleteCloudinaryImages = async (urls: string | string[]) => {
    try {
        const urlArray = Array.isArray(urls) ? urls : [urls];
        const deletePromises = urlArray.map(url => {
            const publicId = getPublicIdFromUrl(url);
            if (publicId) {
                return cloudinary.uploader.destroy(publicId);
            }
            return Promise.resolve();
        });
        await Promise.all(deletePromises);
    } catch (error) {
        console.error('Error deleting Cloudinary images:', error);
    }
};


const calculateSimilarity = (product1: IProduct, product2: IProduct): number => {
    const categorySimilarity = product1.category.equals(product2.category) ? 1 : 0;
    
    const words1 = product1.description.toLowerCase().split(/\s+/);
    const words2 = product2.description.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const descriptionSimilarity = commonWords.length;
    
    return descriptionSimilarity + categorySimilarity;
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const { title, description, price, category, mainImage, additionalImages } = req.body;

        if (!title || !description || !price || !category || !mainImage) {
            res.status(400).json({ success: false, message: 'Required fields are missing' });
            return;
        }

        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            res.status(400).json({ success: false, message: 'Category does not exist' });
            return;
        }

        let mainImageResult;
        try {
            mainImageResult = await cloudinary.uploader.upload(mainImage, {
                folder: 'products'
            });
        } catch (uploadError) {
            res.status(400).json({ 
                success: false, 
                message: 'Error uploading main image',
                error: (uploadError as Error).message 
            });
            return;
        }

        let additionalImagesResults = [];
        if (additionalImages && additionalImages.length > 0) {
            try {
                const uploadPromises = additionalImages.map((image: string) => 
                    cloudinary.uploader.upload(image, { folder: 'products/additional' })
                );
                additionalImagesResults = await Promise.all(uploadPromises);
            } catch (uploadError) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Error uploading additional images',
                    error: (uploadError as Error).message 
                });
                return;
            }
        }

        const product = new Product({
            title,
            description,
            price: parseFloat(price),
            category,
            mainImage: mainImageResult.secure_url,
            additionalImages: additionalImagesResults.map(img => img.secure_url)
        });

        await product.save();

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: product
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error creating product',
            error: error.message
        });
    }
};

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const products = await Product.find()
            .populate('category', 'name')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalProducts = await Product.countDocuments();
        const totalPages = Math.ceil(totalProducts / limit);

        res.status(200).json({
            success: true,
            message: 'Products fetched successfully',
            data: products,
            pagination: {
                currentPage: page,
                totalPages,
                totalProducts
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error fetching products',
            error: error.message
        });
    }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id).populate('category', 'name');

        if (!product) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Product fetched successfully',
            data: product
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error fetching product',
            error: error.message
        });
    }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { title, description, price, category, mainImage, additionalImages } = req.body;

        const existingProduct = await Product.findById(id);
        if (!existingProduct) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }

        let imagesToDelete: string[] = [];

        let mainImageUrl = existingProduct.mainImage;
        if (mainImage && mainImage !== existingProduct.mainImage) {
            try {
                imagesToDelete.push(existingProduct.mainImage);
                
                const result = await cloudinary.uploader.upload(mainImage, {
                    folder: 'products'
                });
                mainImageUrl = result.secure_url;
            } catch (uploadError) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Error uploading main image',
                    error: (uploadError as Error).message 
                });
                return;
            }
        }

        let additionalImagesUrls = existingProduct.additionalImages;
        if (additionalImages && additionalImages.length > 0) {
            try {
                imagesToDelete = [...imagesToDelete, ...existingProduct.additionalImages];

                const uploadPromises = additionalImages.map((image: string) => 
                    cloudinary.uploader.upload(image, { folder: 'products/additional' })
                );
                const results = await Promise.all(uploadPromises);
                additionalImagesUrls = results.map(img => img.secure_url);
            } catch (uploadError) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Error uploading additional images',
                    error: (uploadError as Error).message 
                });
                return;
            }
        }

        // Update product
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                title: title || existingProduct.title,
                description: description || existingProduct.description,
                price: price ? parseFloat(price) : existingProduct.price,
                category: category || existingProduct.category,
                mainImage: mainImageUrl,
                additionalImages: additionalImagesUrls
            },
            { new: true, runValidators: true }
        ).populate('category', 'name');
        if (imagesToDelete.length > 0) {
            deleteCloudinaryImages(imagesToDelete).catch(error => {
                console.error('Background image deletion error:', error);
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: updatedProduct
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error updating product',
            error: error.message
        });
    }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }

        const imagesToDelete = [
            product.mainImage,
            ...product.additionalImages
        ].filter(url => url);

        if (imagesToDelete.length > 0) {
            deleteCloudinaryImages(imagesToDelete).catch(error => {
                console.error('Background image deletion error:', error);
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error deleting product',
            error: error.message
        });
    }
};

export const getRecommendedProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const currentProduct = await Product.findById(id);
        
        if (!currentProduct) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }

        // Get all other products except the current one
        const allProducts = await Product.find({ _id: { $ne: id } }).populate('category', 'name');

        // Calculate similarity scores for each product
        const productsWithScores = allProducts.map(product => ({
            product,
            score: calculateSimilarity(currentProduct, product)
        }));

        // Sort by score in descending order
        productsWithScores.sort((a, b) => b.score - a.score);

        // Get top 5 recommended products
        const recommendedProducts = productsWithScores
            .slice(0, 5)
            .map(item => item.product);

        res.status(200).json({
            success: true,
            message: 'Recommended products fetched successfully',
            data: recommendedProducts
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error fetching recommended products',
            error: error.message
        });
    }
};