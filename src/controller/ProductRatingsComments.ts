// controller/ProductRatingsComments.ts
import { Request, Response } from 'express';
import Product, { IProduct, IComment, IReply, IRating } from '../model/Product';
import mongoose from 'mongoose';

// Helper function to find subdocument by ID
const findCommentById = (product: IProduct, commentId: string): IComment | null => {
  return product.comments.find(
    (comment: IComment) => comment._id?.toString() === commentId
  ) || null;
};

const findReplyById = (comment: IComment, replyId: string): IReply | null => {
  return comment.replies.find(
    (reply: IReply) => reply._id?.toString() === replyId
  ) || null;
};

// Add rating to a product
export const addRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const { user, value } = req.body;

    if (!user || !value) {
      res.status(400).json({ error: 'User and rating value are required' });
      return;
    }

    if (value < 1 || value > 5) {
      res.status(400).json({ error: 'Rating value must be between 1 and 5' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check if user already rated this product
    const existingRatingIndex = product.ratings.findIndex((r: IRating) => r.user === user);
    
    if (existingRatingIndex !== -1) {
      // Update existing rating
      product.ratings[existingRatingIndex].value = value;
    } else {
      // Add new rating
      product.ratings.push({ user, value } as IRating);
    }

    // Calculate average rating
    if (product.ratings.length > 0) {
      const total = product.ratings.reduce((sum, rating) => sum + rating.value, 0);
      product.averageRating = parseFloat((total / product.ratings.length).toFixed(1));
    } else {
      product.averageRating = 0;
    }

    await product.save();
    res.status(200).json({ 
      message: 'Rating added successfully', 
      averageRating: product.averageRating 
    });
  } catch (error) {
    res.status(500).json({ error: 'Error adding rating', details: error });
  }
};

// Add comment to a product
export const addComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const { user, text } = req.body;

    if (!user || !text) {
      res.status(400).json({ error: 'User and text are required' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Create a new comment object with proper structure
    const newComment: Partial<IComment> = {
      user,
      text,
      likes: [],
      replies: []
    };

    product.comments.push(newComment as IComment);
    await product.save();

    const savedComment = product.comments[product.comments.length - 1];
    res.status(201).json({ message: 'Comment added successfully', comment: savedComment });
  } catch (error) {
    res.status(500).json({ error: 'Error adding comment', details: error });
  }
};

// Add reply to a comment
export const addReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, commentId } = req.params;
    const { user, text } = req.body;

    if (!user || !text) {
      res.status(400).json({ error: 'User and text are required' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const comment = findCommentById(product, commentId);
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Create a new reply object with proper structure
    const newReply: Partial<IReply> = {
      user,
      text,
      likes: []
    };

    comment.replies.push(newReply as IReply);
    await product.save();

    const savedReply = comment.replies[comment.replies.length - 1];
    res.status(201).json({ message: 'Reply added successfully', reply: savedReply });
  } catch (error) {
    res.status(500).json({ error: 'Error adding reply', details: error });
  }
};

// Like a comment
export const likeComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, commentId } = req.params;
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const comment = findCommentById(product, commentId);
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check if user already liked this comment
    const likeIndex = comment.likes.indexOf(username);
    if (likeIndex === -1) {
      comment.likes.push(username);
    } else {
      comment.likes.splice(likeIndex, 1); // Unlike if already liked
    }

    await product.save();
    res.status(200).json({ 
      message: likeIndex === -1 ? 'Comment liked successfully' : 'Comment unliked successfully',
      likes: comment.likes 
    });
  } catch (error) {
    res.status(500).json({ error: 'Error liking comment', details: error });
  }
};

// Like a reply
export const likeReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, commentId, replyId } = req.params;
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const comment = findCommentById(product, commentId);
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    const reply = findReplyById(comment, replyId);
    if (!reply) {
      res.status(404).json({ error: 'Reply not found' });
      return;
    }

    // Check if user already liked this reply
    const likeIndex = reply.likes.indexOf(username);
    if (likeIndex === -1) {
      reply.likes.push(username);
    } else {
      reply.likes.splice(likeIndex, 1); // Unlike if already liked
    }

    await product.save();
    res.status(200).json({ 
      message: likeIndex === -1 ? 'Reply liked successfully' : 'Reply unliked successfully',
      likes: reply.likes 
    });
  } catch (error) {
    res.status(500).json({ error: 'Error liking reply', details: error });
  }
};

// Delete a comment
export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, commentId } = req.params;
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const comment = findCommentById(product, commentId);
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check if the user is the owner of the comment
    if (comment.user !== username) {
      res.status(403).json({ error: 'You can only delete your own comments' });
      return;
    }

    // Remove the comment by filtering it out
    product.comments = product.comments.filter(
      (c: IComment) => c._id?.toString() !== commentId
    );
    
    await product.save();
    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting comment', details: error });
  }
};

// Delete a reply
export const deleteReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, commentId, replyId } = req.params;
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const comment = findCommentById(product, commentId);
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    const reply = findReplyById(comment, replyId);
    if (!reply) {
      res.status(404).json({ error: 'Reply not found' });
      return;
    }

    // Check if the user is the owner of the reply
    if (reply.user !== username) {
      res.status(403).json({ error: 'You can only delete your own replies' });
      return;
    }

    // Remove the reply by filtering it out
    comment.replies = comment.replies.filter(
      (r: IReply) => r._id?.toString() !== replyId
    );
    
    await product.save();
    res.status(200).json({ message: 'Reply deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting reply', details: error });
  }
};

export const getProductReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    
    // Validate productId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID format' });
      return;
    }

    const product = await Product.findById(productId)
      .select('ratings comments averageRating')
      .lean();

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Ensure we always return arrays even if they're empty
    const ratings = product.ratings || [];
    const comments = product.comments || [];
    const averageRating = product.averageRating || 0;

    res.status(200).json({
      ratings,
      comments,
      averageRating,
      totalRatings: ratings.length,
      totalComments: comments.length
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ 
      error: 'Error fetching reviews', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};