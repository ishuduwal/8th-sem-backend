import express, { Router } from "express";
import {upload} from "../middleware/Upload";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controller/Category";

const categoryRouter = Router();

categoryRouter.post("/", upload.single("image"), createCategory);
categoryRouter.get("/", getAllCategories);
categoryRouter.get("/:id", getCategoryById);
categoryRouter.put("/:id", upload.single("image"), updateCategory);
categoryRouter.delete("/:id", deleteCategory);

export default categoryRouter;
