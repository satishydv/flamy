import { Router } from "express";
import {
  sendOtpController,
  verifyOtpController,
  loginWithPasswordController,
  resendOtpController,
} from "../controllers/otp.controller.js";

const router = Router();

// Send OTP to mobile
router.post("/send", sendOtpController);

// Verify OTP & create account/login
router.post("/verify", verifyOtpController);

// Direct Mobile + Password login
router.post("/login", loginWithPasswordController);

// Resend OTP
router.post("/resend", resendOtpController);

export default router;
