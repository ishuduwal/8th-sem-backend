import { Router } from 'express';
import {
  signup,
  login,
  refreshToken,
  logout,
  requestPasswordReset,
  verifyOTPAndResetPassword,
  resendOTP,
} from '../controller/User';
import { authenticate } from '../middleware/User';

const userRouter = Router();

// Authentication routes
userRouter.post('/signup', signup);
userRouter.post('/login', login);
userRouter.post('/refresh-token', refreshToken);
userRouter.post('/logout', authenticate, logout);

// Password reset routes
userRouter.post('/request-password-reset', requestPasswordReset);
userRouter.post('/verify-otp-reset-password', verifyOTPAndResetPassword);
userRouter.post('/resend-otp', resendOTP);

export default userRouter;