import { Router, type IRouter } from "express";
import healthRouter from "./health";
import garmentsRouter from "./garments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(garmentsRouter);

export default router;
