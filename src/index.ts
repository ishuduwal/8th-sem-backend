import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import userRouter from "./router/User";
import cors from "cors";
import categoryRouter from "./router/Category";
import productRouter from "./router/Product";
import orderRouter from "./router/Order";
import cartRouter from "./router/Cart";
import dashboardRouter from "./router/Dashboard";

dotenv.config();

const app = express();
const PORT = 5000;
const mongodb = process.env.mongodb || "";

app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 


app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Request Body:', req.body);
  next();
});

app.use('/api/users', userRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/products', productRouter);
app.use('/api/order', orderRouter);
app.use('/api/cart', cartRouter);
app.use('/api/dashboard', dashboardRouter);

mongoose.connect(mongodb).then(() => {
    console.log('Connected to mongodb');
    console.log("Hwllo from sever");
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}).catch((error) => {
    console.error('Mongodb connection error:', error);
});  