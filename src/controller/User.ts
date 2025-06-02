import { Request, Response, NextFunction } from 'express';
import User from '../model/User';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/Jwt';
import { comparePassword, hashPassword } from '../utils/Password';

export const signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      res.status(400).json({ message: 'Request body is empty' });
      return;
    }

    const { username, email, password } = req.body;
    let { isAdmin } = req.body;

    // Validation
    if (!username?.trim()) {
      res.status(400).json({ message: 'Username is required' });
      return;
    }
    if (!email?.trim()) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }
    if (!password?.trim()) {
      res.status(400).json({ message: 'Password is required' });
      return;
    }

    // Prevent self-assignment of admin role
    isAdmin = false; // Default to false, admin must be set manually in DB

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const user = new User({ 
      username, 
      email, 
      password,
      isAdmin
    });

    await user.save();

    const accessToken = generateAccessToken({ 
      userId: user._id.toString(), 
      username: user.username,
      isAdmin: user.isAdmin
    });
    
    const refreshToken = generateRefreshToken({ 
      userId: user._id.toString(), 
      username: user.username,
      isAdmin: user.isAdmin
    });

    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: 'Username and password are required' });
      return;
    }

    const user = await User.findOne({ username });
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const accessToken = generateAccessToken({ 
      userId: user._id.toString(), 
      username: user.username,
      isAdmin: user.isAdmin
    });
    
    const refreshToken = generateRefreshToken({ 
      userId: user._id.toString(), 
      username: user.username,
      isAdmin: user.isAdmin
    });

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      message: 'Logged in successfully',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ message: 'Refresh token is required' });
      return;
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId);
    
    if (!user || user.refreshToken !== refreshToken) {
      res.status(401).json({ message: 'Invalid refresh token' });
      return;
    }

    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      username: user.username,
      isAdmin: user.isAdmin
    });

    res.json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({ message: 'User ID is required' });
      return;
    }

    await User.findByIdAndUpdate(userId, { refreshToken: null });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};