import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";

/**
 * Ensures at least one initial Super Admin exists in the database.
 * If the admin_user table is completely empty, it seeds a default superadmin.
 */
export const ensureSuperAdmin = async () => {
  try {
    const adminCount = await prisma.adminUser.count();
    if (adminCount === 0) {
      const defaultEmail = process.env.ADMIN_DEFAULT_EMAIL || "admin@flamy.com";
      const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || "Admin@123456";
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const created = await prisma.adminUser.create({
        data: {
          email: defaultEmail.toLowerCase().trim(),
          name: "System Superadmin",
          password: hashedPassword,
          role: "superadmin",
          isActive: true,
        },
      });
      console.log(`[ADMIN SEED] Initial Super Admin initialized: ${created.email}`);
    }
  } catch (error) {
    // Suppress if table doesn't exist yet before db push
    console.warn("[ADMIN SEED WARNING]: Could not verify admin count yet.", error.message);
  }
};

/**
 * Admin Login
 * POST /api/admin/auth/login
 */
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if any admin exists, if not initialize default
    await ensureSuperAdmin();

    const admin = await prisma.adminUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin credentials.",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "This admin account is currently deactivated.",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin credentials.",
      });
    }

    // Generate cryptographically secure session token
    const token = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store in admin_session table
    await prisma.adminSession.create({
      data: {
        token,
        adminId: admin.id,
        expiresAt,
      },
    });

    // Update last login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    });

    return res.json({
      success: true,
      message: "Admin authentication successful.",
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        avatar: admin.avatar,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (error) {
    console.error("[ADMIN LOGIN ERROR]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to log in.",
    });
  }
};

/**
 * Admin Logout
 * POST /api/admin/auth/logout
 */
export const adminLogout = async (req, res) => {
  try {
    if (req.adminSession?.token) {
      await prisma.adminSession.deleteMany({
        where: { token: req.adminSession.token },
      });
    }
    return res.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("[ADMIN LOGOUT ERROR]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to log out.",
    });
  }
};

/**
 * Get current admin session profile
 * GET /api/admin/auth/me
 */
export const getAdminMe = async (req, res) => {
  try {
    return res.json({
      success: true,
      admin: req.admin,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

/**
 * Dashboard Overview Statistics
 * GET /api/admin/stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalProfiles,
      totalMatches,
      totalMessages,
      totalReports,
      pendingReports,
      totalEncounters,
      verifiedPhoneUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.profile.count(),
      prisma.match.count(),
      prisma.message.count(),
      prisma.report.count(),
      prisma.report.count({ where: { status: "pending" } }),
      prisma.encounter.count(),
      prisma.user.count({ where: { phoneNumberVerified: true } }),
    ]);

    // Fetch gender distribution from Profile
    const maleCount = await prisma.profile.count({ where: { gender: { equals: "Male", mode: "insensitive" } } });
    const femaleCount = await prisma.profile.count({ where: { gender: { equals: "Female", mode: "insensitive" } } });
    const nonBinaryCount = await prisma.profile.count({ where: { gender: { notIn: ["Male", "Female"], mode: "insensitive" } } });

    // Recent 5 registered users
    const recentUsers = await prisma.user.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        image: true,
        createdAt: true,
        phoneNumberVerified: true,
        profile: {
          select: {
            age: true,
            gender: true,
            location: true,
            avatarUrl: true,
            jobTitle: true,
          },
        },
      },
    });

    // Recent 5 reports
    const recentReports = await prisma.report.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: { id: true, name: true, image: true, email: true },
        },
        reported: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
    });

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalProfiles,
        totalMatches,
        totalMessages,
        totalReports,
        pendingReports,
        totalEncounters,
        verifiedPhoneUsers,
        genderBreakdown: {
          male: maleCount,
          female: femaleCount,
          other: nonBinaryCount,
        },
      },
      recentUsers,
      recentReports,
    });
  } catch (error) {
    console.error("[ADMIN STATS ERROR]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load dashboard metrics.",
    });
  }
};

/**
 * List Users with Search, Filter & Pagination
 * GET /api/admin/users
 */
export const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const { search, gender, verified } = req.query;

    const where = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phoneNumber: { contains: q, mode: "insensitive" } },
      ];
    }

    if (verified === "true") {
      where.phoneNumberVerified = true;
    } else if (verified === "false") {
      where.phoneNumberVerified = false;
    }

    if (gender && gender !== "all") {
      where.profile = {
        gender: { equals: gender, mode: "insensitive" },
      };
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          phoneNumberVerified: true,
          emailVerified: true,
          image: true,
          createdAt: true,
          profile: {
            select: {
              age: true,
              gender: true,
              location: true,
              avatarUrl: true,
              jobTitle: true,
              isGhostMode: true,
              isIncognito: true,
              lastActive: true,
            },
          },
          photos: {
            select: { id: true, url: true },
            take: 1,
          },
          _count: {
            select: {
              sentLikes: true,
              receivedLikes: true,
              matchesAsUser1: true,
              matchesAsUser2: true,
              reportsReceived: true,
            },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("[ADMIN GET USERS ERROR]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch users.",
    });
  }
};

/**
 * Get detailed profile of a single user
 * GET /api/admin/users/:id
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        preference: true,
        photos: {
          orderBy: { order: "asc" },
        },
        reportsReceived: {
          include: {
            reporter: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: {
          select: {
            sentLikes: true,
            receivedLikes: true,
            matchesAsUser1: true,
            matchesAsUser2: true,
            sentMessages: true,
            receivedMessages: true,
            blocksCreated: true,
            blocksReceived: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("[ADMIN GET USER DETAIL ERROR]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user details.",
    });
  }
};

/**
 * Update user status / profile directly
 * PATCH /api/admin/users/:id
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { phoneNumberVerified, emailVerified, name, bio, isGhostMode } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phoneNumberVerified !== undefined && { phoneNumberVerified }),
        ...(emailVerified !== undefined && { emailVerified }),
        profile: {
          update: {
            ...(bio !== undefined && { bio }),
            ...(isGhostMode !== undefined && { isGhostMode }),
          },
        },
      },
      include: {
        profile: true,
      },
    });

    return res.json({
      success: true,
      message: "User updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("[ADMIN UPDATE USER ERROR]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update user.",
    });
  }
};

/**
 * Permanently delete a user
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: "User and related records removed successfully.",
    });
  } catch (error) {
    console.error("[ADMIN DELETE USER ERROR]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete user.",
    });
  }
};

/**
 * List Reports with Status Filter
 * GET /api/admin/reports
 */
export const getReports = async (req, res) => {
  try {
    const { status, category } = req.query;

    const where = {};
    if (status && status !== "all") {
      where.status = status;
    }
    if (category && category !== "all") {
      where.category = category;
    }

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phoneNumber: true,
          },
        },
        reported: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phoneNumber: true,
            profile: {
              select: {
                avatarUrl: true,
                age: true,
                gender: true,
              },
            },
          },
        },
      },
    });

    return res.json({
      success: true,
      reports,
    });
  } catch (error) {
    console.error("[ADMIN GET REPORTS ERROR]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch reports.",
    });
  }
};

/**
 * Update report status (e.g. resolve, dismiss, ban reported user)
 * PATCH /api/admin/reports/:id
 */
export const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, banUser } = req.body;

    const report = await prisma.report.update({
      where: { id },
      data: { status },
      include: { reported: true },
    });

    if (banUser && report.reportedId) {
      await prisma.user.delete({
        where: { id: report.reportedId },
      });
    }

    return res.json({
      success: true,
      message: `Report marked as ${status}${banUser ? " and reported account was deleted" : ""}.`,
      report,
    });
  } catch (error) {
    console.error("[ADMIN UPDATE REPORT ERROR]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update report.",
    });
  }
};

/**
 * List all admin accounts
 * GET /api/admin/admins
 */
export const getAdmins = async (req, res) => {
  try {
    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    return res.json({
      success: true,
      admins,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch admins.",
    });
  }
};

/**
 * Create a new admin account
 * POST /api/admin/admins
 */
export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    const existing = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An admin with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await prisma.adminUser.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: role || "admin",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Admin created successfully.",
      admin: newAdmin,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create admin.",
    });
  }
};

/**
 * Toggle admin active status
 * PATCH /api/admin/admins/:id/toggle
 */
export const toggleAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deactivation
    if (id === req.admin.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own admin account.",
      });
    }

    const current = await prisma.adminUser.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ success: false, message: "Admin not found." });
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: { isActive: !current.isActive },
      select: { id: true, email: true, name: true, isActive: true },
    });

    return res.json({
      success: true,
      message: `Admin ${updated.isActive ? "activated" : "deactivated"} successfully.`,
      admin: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to toggle status.",
    });
  }
};
