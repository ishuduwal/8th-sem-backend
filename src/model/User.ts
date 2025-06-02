import mongoose, { Document, Schema } from 'mongoose';
import { hashPassword } from '../utils/Password';

export interface IUser extends Document {
  _id: string,
  username: string;
  email: string;
  password: string;
  refreshToken?: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    refreshToken: { type: String },
    isAdmin: {type: Boolean, default: false},
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await hashPassword(this.password);
  next();
});

export default mongoose.model<IUser>('User', UserSchema);