import { Request, Response, NextFunction } from 'express';
import Cart, { ICart, ICartItem } from '../model/Cart';
import Product, { IProduct } from '../model/Product';
import mongoose from 'mongoose';

// Add item to cart
export const addToCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userEmail, productId, quantity = 1 } = req.body;

    if (!userEmail || !productId) {
      res.status(400).json({ message: 'User email and product ID are required' });
      return;
    }

    if (quantity < 1) {
      res.status(400).json({ message: 'Quantity must be at least 1' });
      return;
    }

    // Find the product
    const product = await Product.findById(productId) as IProduct | null;
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    // Check stock availability
    if (product.stock < quantity) {
      res.status(400).json({ message: 'Insufficient stock' });
      return;
    }

    // Find or create user's cart
    let cart = await Cart.findOne({ userEmail });
    if (!cart) {
      cart = new Cart({ userEmail, items: [] });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      // Update quantity if item exists
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      
      if (product.stock < newQuantity) {
        res.status(400).json({ message: 'Not enough stock for requested quantity' });
        return;
      }
      
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item to cart
      const cartItem: ICartItem = {
        product: new mongoose.Types.ObjectId(productId),
        quantity,
        price: product.price,
        name: product.name,
        image: product.mainImage
      };
      cart.items.push(cartItem);
    }

    await cart.save();
    
    res.status(200).json({
      message: 'Item added to cart successfully',
      cart
    });

  } catch (error) {
    console.error('Add to cart error:', error);
    next(error);
  }
};

// Get user's cart
export const getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userEmail } = req.params;

    if (!userEmail) {
      res.status(400).json({ message: 'User email is required' });
      return;
    }

    const cart = await Cart.findOne({ userEmail });
    
    if (!cart) {
      res.status(200).json({
        cart: {
          userEmail,
          items: [],
          totalAmount: 0
        }
      });
      return;
    }

    res.status(200).json({ cart });

  } catch (error) {
    console.error('Get cart error:', error);
    next(error);
  }
};

// Update item quantity in cart
export const updateCartItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userEmail, productId, quantity } = req.body;

    if (!userEmail || !productId || quantity === undefined) {
      res.status(400).json({ message: 'User email, product ID, and quantity are required' });
      return;
    }

    if (quantity < 0) {
      res.status(400).json({ message: 'Quantity cannot be negative' });
      return;
    }

    const cart = await Cart.findOne({ userEmail });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      res.status(404).json({ message: 'Item not found in cart' });
      return;
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      cart.items.splice(itemIndex, 1);
    } else {
      // Check stock availability
      const product = await Product.findById(productId);
      if (!product) {
        res.status(404).json({ message: 'Product not found' });
        return;
      }

      if (product.stock < quantity) {
        res.status(400).json({ message: 'Insufficient stock' });
        return;
      }

      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();

    res.status(200).json({
      message: 'Cart updated successfully',
      cart
    });

  } catch (error) {
    console.error('Update cart item error:', error);
    next(error);
  }
};

// Remove item from cart
export const removeFromCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userEmail, productId } = req.body;

    if (!userEmail || !productId) {
      res.status(400).json({ message: 'User email and product ID are required' });
      return;
    }

    const cart = await Cart.findOne({ userEmail });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      res.status(404).json({ message: 'Item not found in cart' });
      return;
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    res.status(200).json({
      message: 'Item removed from cart successfully',
      cart
    });

  } catch (error) {
    console.error('Remove from cart error:', error);
    next(error);
  }
};

// Clear entire cart
export const clearCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userEmail } = req.params;

    if (!userEmail) {
      res.status(400).json({ message: 'User email is required' });
      return;
    }

    const cart = await Cart.findOne({ userEmail });
    if (!cart) {
      res.status(200).json({ message: 'Cart is already empty' });
      return;
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      message: 'Cart cleared successfully',
      cart
    });

  } catch (error) {
    console.error('Clear cart error:', error);
    next(error);
  }
};

// Get cart items count
export const getCartCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userEmail } = req.params;

    if (!userEmail) {
      res.status(400).json({ message: 'User email is required' });
      return;
    }

    const cart = await Cart.findOne({ userEmail });
    const count = cart ? cart.items.reduce((total, item) => total + item.quantity, 0) : 0;

    res.status(200).json({ count });

  } catch (error) {
    console.error('Get cart count error:', error);
    next(error);
  }
};