import { Router } from "express";
import { Controller } from "../controllers/index.js";
import upload from "../utils/multer.js";

const router = Router();

router.post("/upload", upload.single("file"), Controller.uploadFile);
router.get("/upload/:jobId", Controller.getJobStatus);
router.get("/policies", Controller.searchPolicy);
router.get("/policies/aggregate/by-user", Controller.getPolicies);
router.post("/schedule-message", Controller.scheduleMessage);

export default router;
