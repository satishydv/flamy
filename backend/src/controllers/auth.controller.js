import { auth } from "../config/auth.js";

/**
 * Get current user session
 */
export const getSessionController = async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });
    if (!session) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    return res.json({ success: true, data: session });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get active social providers status
 */
export const getProvidersController = (req, res) => {
  return res.json({
    success: true,
    providers: [
      {
        id: "google",
        name: "Google",
        configured: !!process.env.GOOGLE_CLIENT_ID,
      },
      {
        id: "facebook",
        name: "Facebook",
        configured: !!process.env.FACEBOOK_CLIENT_ID,
      },
    ],
  });
};
