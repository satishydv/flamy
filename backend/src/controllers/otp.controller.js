import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { formatPhoneNumber, sendOtpSms } from "../services/msg91.service.js";

/**
 * Send 6-digit OTP to phone number
 */
export const sendOtpController = async (req, res) => {
  try {
    const { phone, mode } = req.body;

    if (!phone || typeof phone !== "string" || phone.trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid phone number (minimum 10 digits)",
      });
    }

    const formattedPhone = formatPhoneNumber(phone.trim());

    // If signing up, check if this phone number is already registered & verified
    if (mode === "signup") {
      const existingUser = await prisma.user.findFirst({
        where: { phoneNumber: formattedPhone, phoneNumberVerified: true },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "This mobile number is already registered. Please switch to Log In.",
        });
      }
    }

    // Rate limiting: check if an unexpired OTP was sent in the last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const recentOtp = await prisma.otp.findFirst({
      where: {
        phone: formattedPhone,
        createdAt: { gte: thirtySecondsAgo },
      },
    });

    if (recentOtp) {
      return res.status(429).json({
        success: false,
        message: "Please wait 30 seconds before requesting another OTP.",
      });
    }

    // Generate secure 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 10 minutes expiry fixed
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Persist OTP record in database
    await prisma.otp.create({
      data: {
        phone: formattedPhone,
        otp: otpCode,
        expiresAt,
        verified: false,
        attempts: 0,
      },
    });

    // Send SMS via MSG91 API
    const smsResult = await sendOtpSms({
      phone: formattedPhone,
      otp: otpCode,
      expiryMinutes: 10,
    });

    return res.json({
      success: true,
      message: smsResult.message || "OTP sent successfully. Valid for 10 minutes.",
      phone: formattedPhone,
      expiresInSeconds: 600,
    });
  } catch (error) {
    console.error("[OTP CONTROLLER] sendOtp error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send OTP",
    });
  }
};

/**
 * Verify OTP and login / create account (with optional password setting)
 */
export const verifyOtpController = async (req, res) => {
  try {
    const { phone, otp, name, password } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required.",
      });
    }

    const formattedPhone = formatPhoneNumber(phone.trim());
    const cleanOtp = otp.toString().trim();

    // Find the latest active unverified OTP for this phone
    const latestOtp = await prisma.otp.findFirst({
      where: {
        phone: formattedPhone,
        verified: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!latestOtp) {
      return res.status(400).json({
        success: false,
        message: "No active OTP request found for this number. Please request a new OTP.",
      });
    }

    // 10-minute expiry check
    if (new Date() > new Date(latestOtp.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    // Max attempts check (brute-force protection)
    if (latestOtp.attempts >= 5) {
      return res.status(400).json({
        success: false,
        message: "Too many incorrect attempts. Please request a fresh OTP.",
      });
    }

    // Verify OTP matching
    if (latestOtp.otp !== cleanOtp) {
      // Increment attempt counter
      await prisma.otp.update({
        where: { id: latestOtp.id },
        data: { attempts: latestOtp.attempts + 1 },
      });

      const remaining = 5 - (latestOtp.attempts + 1);
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remaining} attempts remaining.`,
      });
    }

    // Mark OTP verified
    await prisma.otp.update({
      where: { id: latestOtp.id },
      data: { verified: true },
    });

    // Find or create User
    let user = await prisma.user.findFirst({
      where: { phoneNumber: formattedPhone },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const customName = name?.trim() || `User_${formattedPhone.slice(-4)}`;
      user = await prisma.user.create({
        data: {
          id: "usr_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
          name: customName,
          phoneNumber: formattedPhone,
          phoneNumberVerified: true,
        },
      });
    } else {
      if (!user.phoneNumberVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { phoneNumberVerified: true },
        });
      }
      if (name?.trim() && user.name.startsWith("User_")) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name: name.trim() },
        });
      }
    }

    // If password provided (e.g. from sign up or password reset), store hashed password in Account
    if (password && typeof password === "string" && password.trim().length > 0) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      const existingAccount = await prisma.account.findFirst({
        where: {
          userId: user.id,
          providerId: "credential",
        },
      });

      if (existingAccount) {
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: { password: hashedPassword },
        });
      } else {
        await prisma.account.create({
          data: {
            id: "acc_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
            accountId: formattedPhone,
            providerId: "credential",
            userId: user.id,
            password: hashedPassword,
          },
        });
      }
    }

    // Generate session
    const sessionToken = "sess_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await prisma.session.create({
      data: {
        id: "ses_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
        userId: user.id,
        token: sessionToken,
        expiresAt: sessionExpiresAt,
        userAgent: req.headers["user-agent"] || "MobileApp",
        ipAddress: req.ip || req.socket?.remoteAddress || "127.0.0.1",
      },
    });

    const isHttps =
      process.env.NODE_ENV === "production" ||
      process.env.BETTER_AUTH_URL?.startsWith("https://");

    // Set cookie compatible with BetterAuth
    res.cookie("better-auth.session_token", sessionToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
      success: true,
      message: isNewUser ? "Account created successfully" : "Logged in successfully",
      isNewUser,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        image: user.image,
      },
      session: {
        id: session.id,
        token: session.token,
        expiresAt: session.expiresAt,
      },
      token: sessionToken,
    });
  } catch (error) {
    console.error("[OTP CONTROLLER] verifyOtp error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify OTP",
    });
  }
};

/**
 * Log in directly using Mobile Number + Password
 */
export const loginWithPasswordController = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and password are required.",
      });
    }

    const formattedPhone = formatPhoneNumber(phone.trim());

    // Find user by phone number
    const user = await prisma.user.findFirst({
      where: { phoneNumber: formattedPhone },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this mobile number. Please sign up.",
      });
    }

    // Find credential account
    const account = await prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
      },
    });

    if (!account || !account.password) {
      return res.status(400).json({
        success: false,
        message: "No password set for this account. Please log in with OTP.",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Please try again.",
      });
    }

    // Generate session
    const sessionToken = "sess_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await prisma.session.create({
      data: {
        id: "ses_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
        userId: user.id,
        token: sessionToken,
        expiresAt: sessionExpiresAt,
        userAgent: req.headers["user-agent"] || "MobileApp",
        ipAddress: req.ip || req.socket?.remoteAddress || "127.0.0.1",
      },
    });

    const isHttps =
      process.env.NODE_ENV === "production" ||
      process.env.BETTER_AUTH_URL?.startsWith("https://");

    // Set cookie compatible with BetterAuth
    res.cookie("better-auth.session_token", sessionToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
      success: true,
      message: "Logged in successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        image: user.image,
      },
      session: {
        id: session.id,
        token: session.token,
        expiresAt: session.expiresAt,
      },
      token: sessionToken,
    });
  } catch (error) {
    console.error("[OTP CONTROLLER] loginWithPassword error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to log in",
    });
  }
};

/**
 * Resend OTP
 */
export const resendOtpController = async (req, res) => {
  return sendOtpController(req, res);
};
