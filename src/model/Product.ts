import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  user: string;
  text: string;
  likes: string[];
  replies: IReply[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IReply extends Document {
  _id: mongoose.Types.ObjectId;
  user: string;
  text: string;
  likes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IRating extends Document {
  _id: mongoose.Types.ObjectId;
  user: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  price: number;
  description: string;
  mainImage: string;
  subImages?: string[];
  stock: number;
  category: mongoose.Types.ObjectId;
  ratings: IRating[];
  comments: IComment[];
  averageRating: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReplySchema: Schema = new Schema({
  user: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  likes: [{
    type: String
  }]
}, { timestamps: true });

const CommentSchema: Schema = new Schema({
  user: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  likes: [{
    type: String
  }],
  replies: [ReplySchema]
}, { timestamps: true });

const RatingSchema: Schema = new Schema({
  user: {
    type: String,
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  }
}, { timestamps: true });

const ProductSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true,
    default: ""
  },
  mainImage: {
    type: String,
    required: true
  },
  subImages: [{
    type: String
  }],
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  ratings: [RatingSchema],
  comments: [CommentSchema],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  }
}, { timestamps: true });

// Calculate average rating before saving
ProductSchema.pre<IProduct>('save', function(next) {
  if (this.ratings && this.ratings.length > 0) {
    const total = this.ratings.reduce((sum: number, rating: IRating) => sum + rating.value, 0);
    this.averageRating = parseFloat((total / this.ratings.length).toFixed(1));
  } else {
    this.averageRating = 0;
  }
  next();
});

export default mongoose.model<IProduct>('Product', ProductSchema);