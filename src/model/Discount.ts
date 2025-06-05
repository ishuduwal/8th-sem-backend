// model/Discount.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IDiscount extends Document {
    name: string;
    description?: string;
    percentage: number;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    applyTo: 'ALL' | 'CATEGORY' | 'PRODUCT';
    targetIds: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const DiscountSchema: Schema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    percentage: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    applyTo: {
        type: String,
        enum: ['ALL', 'CATEGORY', 'PRODUCT'],
        required: true
    },
    targetIds: [{
        type: Schema.Types.ObjectId,
        refPath: 'applyTo'
    }]
}, {
    timestamps: true
});

// Add index for better query performance
DiscountSchema.index({ isActive: 1, endDate: 1 });
DiscountSchema.index({ applyTo: 1, targetIds: 1 });

export default mongoose.model<IDiscount>('Discount', DiscountSchema);