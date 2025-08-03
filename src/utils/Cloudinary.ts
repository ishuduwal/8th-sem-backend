import { Readable } from "stream";
import cloudinary from "../config/Cloudinary";

export const uploadToCloudinary = (fileBuffer: Buffer, folder: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { 
        resource_type: "image",
        folder: folder 
      }, 
      (error, result) => {
        if (result) resolve(result.secure_url);
        else reject(error);
      }
    );

    const readable = new Readable();
    readable._read = () => {};
    readable.push(fileBuffer);
    readable.push(null);
    readable.pipe(stream);
  });
};

export const deleteFromCloudinary = async (url: string): Promise<void> => {
  try {
    const publicId = url.split('/').slice(-2).join('/').split('.')[0];
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
};