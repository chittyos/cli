import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import { loggers } from "../utils/logger";

// Rate limiting configurations
export const rateLimiters = {
  // General API rate limit
  general: rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
    message: "Too many requests from this IP, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      loggers.security("Rate limit exceeded", {
        ip: req.ip,
        path: req.path,
        userAgent: req.get("user-agent"),
      });
      res.status(429).json({
        error: "Too many requests",
        retryAfter: res.getHeader("Retry-After"),
      });
    },
  }),

  // Strict rate limit for auth endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    skipSuccessfulRequests: true,
    message: "Too many authentication attempts",
  }),

  // File upload rate limit
  upload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: "Upload limit exceeded",
  }),

  // AI processing rate limit
  ai: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 AI requests per hour
    message: "AI processing limit exceeded",
  }),
};

// Security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      connectSrc: ["'self'", "https://api.chitty.cc", "wss://"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests:
        process.env.NODE_ENV === "production" ? [] : null,
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// CORS configuration
export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(",") || [
      "http://localhost:3000",
    ];

    // Allow requests with no origin (mobile apps, Postman, etc)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      loggers.security("CORS blocked", { origin, ip: "unknown" });
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["X-Total-Count", "X-Page-Count"],
  maxAge: 86400, // 24 hours
};

// Input sanitization middleware
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === "string") {
        req.query[key] = (req.query[key] as string).trim();
      }
    });
  }

  // Sanitize body
  if (req.body && typeof req.body === "object") {
    const sanitizeObject = (obj: any): any => {
      Object.keys(obj).forEach((key) => {
        if (typeof obj[key] === "string") {
          obj[key] = obj[key].trim();
          // Remove null bytes
          obj[key] = obj[key].replace(/\0/g, "");
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      });
    };
    sanitizeObject(req.body);
  }

  next();
};

// SQL injection prevention
export const preventSQLInjection = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|SCRIPT)\b)/i,
    /(--|\#|\/\*|\*\/)/,
    /(\bOR\b\s*\d+\s*=\s*\d+)/i,
    /(\bAND\b\s*\d+\s*=\s*\d+)/i,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value !== "string") return true;
    return !suspiciousPatterns.some((pattern) => pattern.test(value));
  };

  const checkObject = (obj: any): boolean => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === "object" && obj[key] !== null) {
          if (!checkObject(obj[key])) return false;
        } else if (!checkValue(obj[key])) {
          return false;
        }
      }
    }
    return true;
  };

  // Check query parameters
  if (!checkObject(req.query)) {
    loggers.security("SQL injection attempt detected", {
      ip: req.ip,
      path: req.path,
      query: req.query,
    });
    return res.status(400).json({ error: "Invalid input detected" });
  }

  // Check body
  if (req.body && !checkObject(req.body)) {
    loggers.security("SQL injection attempt detected", {
      ip: req.ip,
      path: req.path,
      body: "[REDACTED]",
    });
    return res.status(400).json({ error: "Invalid input detected" });
  }

  next();
};

// XSS prevention
export const preventXSS = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<iframe[\s\S]*?>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  const sanitizeXSS = (value: any): any => {
    if (typeof value !== "string") return value;

    let sanitized = value;
    xssPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, "");
    });

    // HTML encode special characters
    sanitized = sanitized
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");

    return sanitized;
  };

  // Sanitize body recursively
  if (req.body && typeof req.body === "object") {
    const sanitizeObject = (obj: any): void => {
      Object.keys(obj).forEach((key) => {
        if (typeof obj[key] === "string") {
          const original = obj[key];
          obj[key] = sanitizeXSS(obj[key]);
          if (original !== obj[key]) {
            loggers.security("XSS attempt prevented", {
              ip: req.ip,
              path: req.path,
              field: key,
            });
          }
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      });
    };
    sanitizeObject(req.body);
  }

  next();
};

// File upload security
export const fileUploadSecurity = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.file && !req.files) {
    return next();
  }

  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const maxFileSize =
    parseInt(process.env.MAX_FILE_SIZE_MB || "50") * 1024 * 1024;

  const checkFile = (file: Express.Multer.File): boolean => {
    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      loggers.security("Invalid file type upload attempt", {
        ip: req.ip,
        filename: file.originalname,
        mimetype: file.mimetype,
      });
      return false;
    }

    // Check file size
    if (file.size > maxFileSize) {
      loggers.security("File size limit exceeded", {
        ip: req.ip,
        filename: file.originalname,
        size: file.size,
      });
      return false;
    }

    // Check file extension
    const ext = file.originalname.split(".").pop()?.toLowerCase();
    const dangerousExtensions = [
      "exe",
      "sh",
      "bat",
      "cmd",
      "com",
      "pif",
      "scr",
      "vbs",
      "js",
    ];
    if (ext && dangerousExtensions.includes(ext)) {
      loggers.security("Dangerous file extension blocked", {
        ip: req.ip,
        filename: file.originalname,
        extension: ext,
      });
      return false;
    }

    return true;
  };

  // Check single file
  if (req.file && !checkFile(req.file)) {
    return res.status(400).json({ error: "Invalid file upload" });
  }

  // Check multiple files
  if (req.files) {
    const files = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files).flat();
    for (const file of files) {
      if (!checkFile(file as Express.Multer.File)) {
        return res.status(400).json({ error: "Invalid file upload" });
      }
    }
  }

  next();
};

// API key validation
export const validateAPIKey = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }

  // In production, validate against database or cache
  // This is a simplified example
  const validApiKeys = process.env.VALID_API_KEYS?.split(",") || [];

  if (!validApiKeys.includes(apiKey)) {
    loggers.security("Invalid API key", {
      ip: req.ip,
      apiKey: apiKey.substring(0, 8) + "...",
    });
    return res.status(401).json({ error: "Invalid API key" });
  }

  next();
};

// Security audit middleware
export const securityAudit = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Log security-relevant actions
  const auditActions = [
    "/api/auth/login",
    "/api/auth/logout",
    "/api/users/create",
    "/api/users/delete",
    "/api/documents/upload",
    "/api/admin",
  ];

  if (auditActions.some((action) => req.path.startsWith(action))) {
    loggers.audit(req.path, (req as any).user?.id || "anonymous", {
      method: req.method,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
  }

  next();
};
