import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "./prisma.js";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const isHttps =
  process.env.NODE_ENV === "production" ||
  process.env.BETTER_AUTH_URL?.startsWith("https://");

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5001",
  secret: process.env.BETTER_AUTH_SECRET || "dating_app_better_auth_dev_secret_key_12345",
  plugins: [
    bearer(),
  ],
  account: {
    storeStateStrategy: "database",
    skipStateCookieCheck: true,
    accountLinking: {
      enabled: false,
    },
  },
  advanced: {
    disableOriginCheck: true,
    useSecureCookies: isHttps,
    defaultCookieAttributes: {
      sameSite: isHttps ? "none" : "lax",
      secure: isHttps,
      partitioned: isHttps,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_PLACEHOLDER",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "GOOGLE_CLIENT_SECRET_PLACEHOLDER",
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID || "FACEBOOK_CLIENT_ID_PLACEHOLDER",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "FACEBOOK_CLIENT_SECRET_PLACEHOLDER",
    },
  },
  trustedOrigins: [
    "*",
    "http://localhost:*",
    "http://127.0.0.1:*",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:19006",
    "http://localhost:5001",
    "https://backend.ckinfynity.shop",
    "exp://*",
    "exp://**",
    "exp://",
    "datingapp://*",
    "datingapp://**",
    "datingapp://",
    "datingapp:",
  ],
});

export default auth;
