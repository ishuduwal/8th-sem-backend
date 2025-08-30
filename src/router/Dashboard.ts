import { Router } from "express";
import { getDashboardStats, getDashboardStatsByTimeRange } from "../controller/Dashboard";

const dashboardRouter = Router();

dashboardRouter.get("/", getDashboardStats);

dashboardRouter.get("/range/:range", getDashboardStatsByTimeRange);

export default dashboardRouter;