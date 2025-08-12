import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
    name: string;
    price: number;
    description?: string;
    mainImage: string;
    subImages?: string[];
    stock: number;
    category: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

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
        trim: true
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
    }
}, { timestamps: true });

export default mongoose.model<IProduct>('Product', ProductSchema);