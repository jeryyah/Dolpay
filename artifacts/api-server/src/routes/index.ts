import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import syncRouter from "./sync";
import backupRouter from "./backup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(syncRouter);
router.use(backupRouter);

export default router;
