import mongoose, { Document, Schema } from "mongoose";

export interface IProduct extends Document {
    title: string;
    description: string;
    originalPrice: number;
    price: number; // This will be the discounted price
    category: mongoose.Types.ObjectId;
    mainImage: string;
    additionalImages: string[];
    createdAt: Date;
    updatedAt: Date;
}

const ProductSchema: Schema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    originalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    mainImage: {
        type: String,
        required: true
    },
    additionalImages: [{
        type: String
    }]
}, {
    timestamps: true
});

// Middleware to set originalPrice and price before saving
ProductSchema.pre('save', async function(next) {
    if (this.isNew || this.isModified('originalPrice')) {
        this.price = this.originalPrice;
    }
    next();
});

export default mongoose.model<IProduct>('Product', ProductSchema);