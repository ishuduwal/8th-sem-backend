import { Request, Response, NextFunction } from 'express';
import User from '../model/User';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/Jwt';
import { comparePassword, hashPassword } from '../utils/Password';
import { generateOTP, sendOTPEmail } from '../utils/Otp';

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

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: 'Invalid email format' });
      return;
    }

    // Prevent self-assignment of admin role
    isAdmin = false;

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
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email });
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

// Password Reset Functions
export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email?.trim()) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: 'Invalid email format' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Return an error for non-existent email instead of generic success
      res.status(404).json({ 
        message: 'No account found with this email address. Please check your email or sign up for a new account.' 
      });
      return;
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    user.resetOTP = otp;
    user.resetOTPExpiry = otpExpiry;
    await user.save();

    try {
      await sendOTPEmail(user.email, otp, user.username);
      
      res.json({ 
        message: 'OTP sent to your email. Valid for 5 minutes.',
        email: user.email,
        success: true
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // Clear the OTP if email sending failed
      user.resetOTP = undefined;
      user.resetOTPExpiry = undefined;
      await user.save();
      
      res.status(500).json({ 
        message: 'Failed to send OTP email. Please try again later.' 
      });
    }
  } catch (error) {
    console.error('Password reset request error:', error);
    next(error);
  }
};

export const verifyOTPAndResetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email?.trim() || !otp?.trim() || !newPassword?.trim()) {
      res.status(400).json({ message: 'Email, OTP, and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters long' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: 'No account found with this email address' });
      return;
    }

    if (!user.resetOTP || !user.resetOTPExpiry) {
      res.status(400).json({ message: 'No OTP request found. Please request a new OTP.' });
      return;
    }

    if (new Date() > user.resetOTPExpiry) {
      // Clear expired OTP
      user.resetOTP = undefined;
      user.resetOTPExpiry = undefined;
      await user.save();
      
      res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
      return;
    }

    if (user.resetOTP !== otp) {
      res.status(400).json({ message: 'Invalid OTP. Please check your code and try again.' });
      return;
    }

    // Reset password
    user.password = newPassword; // Will be hashed by pre-save middleware
    user.resetOTP = undefined;
    user.resetOTPExpiry = undefined;
    user.refreshToken = undefined; // Invalidate existing sessions
    await user.save();

    res.json({ message: 'Password reset successfully. Please login with your new password.' });
  } catch (error) {
    console.error('Password reset error:', error);
    next(error);
  }
};

export const resendOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email?.trim()) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: 'No account found with this email address' });
      return;
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    user.resetOTP = otp;
    user.resetOTPExpiry = otpExpiry;
    await user.save();

    try {
      await sendOTPEmail(user.email, otp, user.username);
      res.json({ message: 'New OTP sent to your email. Valid for 5 minutes.' });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // Clear the OTP if email sending failed
      user.resetOTP = undefined;
      user.resetOTPExpiry = undefined;
      await user.save();
      
      res.status(500).json({ 
        message: 'Failed to send OTP email. Please try again later.' 
      });
    }
  } catch (error) {
    console.error('Resend OTP error:', error);
    next(error);
  }
};

export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email?.trim() || !otp?.trim()) {
      res.status(400).json({ message: 'Email and OTP are required' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: 'No account found with this email address' });
      return;
    }

    if (!user.resetOTP || !user.resetOTPExpiry) {
      res.status(400).json({ message: 'No OTP request found. Please request a new OTP.' });
      return;
    }

    if (new Date() > user.resetOTPExpiry) {
      // Clear expired OTP
      user.resetOTP = undefined;
      user.resetOTPExpiry = undefined;
      await user.save();
      
      res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
      return;
    }

    if (user.resetOTP !== otp) {
      res.status(400).json({ message: 'Invalid OTP. Please check your code and try again.' });
      return;
    }

    // OTP is valid, but don't reset anything yet
    res.json({ 
      message: 'OTP verified successfully',
      verified: true 
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    next(error);
  }
};

export const updateUserAdminStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isAdmin } = req.body;

    if (typeof isAdmin !== 'boolean') {
      res.status(400).json({ message: 'isAdmin must be a boolean' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isAdmin },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      message: 'User admin status updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await User.find({}, { password: 0, refreshToken: 0, resetOTP: 0, resetOTPExpiry: 0 });
    
    res.json({
      users: users.map(user => ({
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }))
    });
  } catch (error) {
    next(error);
  }
};