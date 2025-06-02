import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/Jwt';
import User from '../model/User';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    isAdmin: boolean;  // Add this
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication invalid' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      isAdmin: decoded.isAdmin  // Add this
    };
    next();
  } catch (error) {
    next(error);
  }
};

// Add admin middleware
export const isAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
};