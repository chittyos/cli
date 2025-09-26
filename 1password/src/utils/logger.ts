import winston from 'winston';
import { Request } from 'express';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(colors);

// Format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    info => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

// Format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add structured logging helpers
export const loggers = {
  // Request logging
  request: (req: Request, message: string, meta?: any) => {
    logger.info(message, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: (req as any).user?.id,
      requestId: (req as any).id,
      ...meta
    });
  },

  // Error logging
  error: (error: Error, req?: Request, meta?: any) => {
    const errorLog: any = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...meta
    };

    if (req) {
      errorLog.request = {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: (req as any).user?.id,
        requestId: (req as any).id
      };
    }

    logger.error(error.message, errorLog);
  },

  // Database query logging
  database: (query: string, params?: any[], duration?: number) => {
    logger.debug('Database query', {
      query,
      params,
      duration,
      timestamp: new Date().toISOString()
    });
  },

  // File operation logging
  file: (operation: string, filename: string, details?: any) => {
    logger.info(`File ${operation}`, {
      operation,
      filename,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  // AI operation logging
  ai: (operation: string, model: string, details?: any) => {
    logger.info(`AI ${operation}`, {
      operation,
      model,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  // Security event logging
  security: (event: string, details: any) => {
    logger.warn(`Security event: ${event}`, {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  // Performance logging
  performance: (operation: string, duration: number, details?: any) => {
    const level = duration > 1000 ? 'warn' : 'debug';
    logger.log(level, `Performance: ${operation}`, {
      operation,
      duration,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  // Audit logging
  audit: (action: string, userId: string, details: any) => {
    logger.info(`Audit: ${action}`, {
      action,
      userId,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
};

// Express middleware for request logging
export const requestLogger = (req: Request, res: any, next: any) => {
  const start = Date.now();
  
  // Log request
  loggers.request(req, 'Incoming request');

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      requestId: (req as any).id
    });

    // Log slow requests
    if (duration > 1000) {
      loggers.performance('Slow request', duration, {
        method: req.method,
        url: req.url,
        status: res.statusCode
      });
    }
  });

  next();
};

// Export the base logger for direct use
export default logger;