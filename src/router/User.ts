import { Router } from 'express';
import {
  signup,
  login,
  refreshToken,
  requestPasswordReset,
  verifyOTPAndResetPassword,
  resendOTP,
  verifyOTP,
  updateUserAdminStatus,
  getAllUsers,
} from '../controller/User';
import { authenticate } from '../middleware/User';

const userRouter = Router();

// Authentication routes
userRouter.post('/signup', signup);
userRouter.post('/login', login);
userRouter.post('/refresh-token', refreshToken);

// Password reset routes
userRouter.post('/request-password-reset', requestPasswordReset);
userRouter.post('/verify-otp-reset-password', verifyOTPAndResetPassword);
userRouter.post('/resend-otp', resendOTP);
userRouter.post('/verify-otp', verifyOTP);

//users list and admin-status
userRouter.get('/users-list', getAllUsers);
userRouter.patch('/users-list/:userId/admin-status', updateUserAdminStatus);

export default userRouter;