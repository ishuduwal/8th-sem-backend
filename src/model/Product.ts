import mongoose, {Document, Schema} from "mongoose";

export interface IProduct extends Document {
    title: string;
    description: string;
    price: string;
    category:mongoose.Types.ObjectId;
    mainImage:string;
    additionalImages: string[];
    createdAt: Date;
    updatedAt: Date;
}

const ProductSchema: Schema = new Schema ({
    title:{
        type:String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
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
})

export default mongoose.model<IProduct>('Product', ProductSchema);