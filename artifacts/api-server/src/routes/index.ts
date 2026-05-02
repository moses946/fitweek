import { Router, type IRouter } from "express";
import healthRouter from "./health";
import garmentsRouter from "./garments";
import weatherRouter from "./weather";

const router: IRouter = Router();

router.use(healthRouter);
router.use(garmentsRouter);
router.use(weatherRouter);

export default router;
