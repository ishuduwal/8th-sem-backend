import { Router } from 'express';
import {
  signup,
  login,
  refreshToken,
  logout,
} from '../controller/User';
import { authenticate } from '../middleware/User';

const userRouter = Router();

userRouter.post('/signup', signup);
userRouter.post('/login', login);
userRouter.post('/refresh-token', refreshToken);
userRouter.post('/logout', authenticate, logout);

export default userRouter;