import { Router, type IRouter } from "express";
import healthRouter from "./health";
import garmentsRouter from "./garments";
import weatherRouter from "./weather";
import vtoRouter from "./vto";
import outfitRouter from "./outfit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(garmentsRouter);
router.use(weatherRouter);
router.use(vtoRouter);
router.use(outfitRouter);

export default router;
