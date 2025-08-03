import mongoose, {Document, Schema } from 'mongoose';

export interface ICategory extends Document {
    name: string;
    description?: string;
    image?: string;
    createdAt: Date;
    updatedAt: Date;
}

const CategorySchema: Schema = new Schema({
    name:{
        type: String,
        required: true,
        unique: true,
        trim:true
    },
    description:{
        type:String,
        trim:true
    },
    image:{
        type: String
    }
},{timestamps: true});

export default mongoose.model<ICategory>('Category', CategorySchema);