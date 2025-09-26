import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import redis from '../services/redis';
import { loggers } from '../utils/logger';
import crypto from 'crypto';

// Response compression
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Balance between speed and compression
  threshold: 1024 // Only compress responses larger than 1KB
});

// Cache key generator
const generateCacheKey = (req: Request): string => {
  const { method, originalUrl, query, body } = req;
  const userId = (req as any).user?.id || 'anonymous';
  
  const keyData = {
    method,
    url: originalUrl,
    query,
    body: method !== 'GET' ? body : undefined,
    userId
  };
  
  return `cache:${crypto
    .createHash('md5')
    .update(JSON.stringify(keyData))
    .digest('hex')}`;
};

// Cache middleware factory
export const cacheMiddleware = (ttl: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache for authenticated users (personalized content)
    if ((req as any).user && !req.headers['x-cache-enabled']) {
      return next();
    }

    const cacheKey = generateCacheKey(req);

    try {
      // Try to get from cache
      const cachedData = await redis.get(cacheKey);
      
      if (cachedData) {
        const { statusCode, headers, body } = JSON.parse(cachedData);
        
        // Set cached headers
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
        
        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        
        loggers.performance('Cache hit', 0, {
          url: req.originalUrl,
          cacheKey
        });
        
        return res.status(statusCode).json(body);
      }
    } catch (error) {
      // If cache fails, continue without it
      console.error('Cache error:', error);
    }

    // Store original res.json
    const originalJson = res.json.bind(res);
    
    // Override res.json to cache the response
    res.json = function(body: any) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheData = {
          statusCode: res.statusCode,
          headers: res.getHeaders(),
          body
        };
        
        // Cache asynchronously
        redis
          .setex(cacheKey, ttl, JSON.stringify(cacheData))
          .catch(err => console.error('Cache set error:', err));
        
        // Add cache headers
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-TTL', ttl.toString());
      }
      
      return originalJson(body);
    };

    next();
  };
};

// Invalidate cache
export const invalidateCache = async (patterns: string[]): Promise<void> => {
  try {
    for (const pattern of patterns) {
      const keys = await redis.keys(`cache:${pattern}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        loggers.performance('Cache invalidated', keys.length, { pattern });
      }
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

// ETag support
export const etagMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  
  res.json = function(body: any) {
    const content = JSON.stringify(body);
    const etag = `"${crypto.createHash('md5').update(content).digest('hex')}"`;
    
    res.setHeader('ETag', etag);
    
    // Check If-None-Match
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      return res.status(304).end();
    }
    
    return originalJson(body);
  };
  
  next();
};

// Response time tracking
export const responseTimeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Log slow requests
    if (duration > 1000) {
      loggers.performance('Slow request', duration, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode
      });
    }
  });
  
  next();
};

// Database query optimization
export const optimizeQueries = {
  // Add indexes hint
  addIndexHint: (query: any, indexes: string[]) => {
    // Implementation depends on ORM
    return query;
  },
  
  // Enable query result caching
  enableQueryCache: async (key: string, ttl: number, queryFn: () => Promise<any>) => {
    const cached = await redis.get(`query:${key}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const result = await queryFn();
    await redis.setex(`query:${key}`, ttl, JSON.stringify(result));
    return result;
  },
  
  // Batch queries
  batchQueries: async (queries: Array<() => Promise<any>>) => {
    return Promise.all(queries);
  }
};

// Memory usage monitoring
export const memoryMonitor = (threshold: number = 0.9) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const usage = process.memoryUsage();
    const heapUsedPercent = usage.heapUsed / usage.heapTotal;
    
    if (heapUsedPercent > threshold) {
      loggers.performance('High memory usage', usage.heapUsed, {
        heapTotal: usage.heapTotal,
        percentage: Math.round(heapUsedPercent * 100)
      });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        loggers.performance('Garbage collection triggered', 0);
      }
    }
    
    next();
  };
};

// Connection pooling configuration
export const connectionPoolConfig = {
  database: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  },
  redis: {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000
  }
};

// Request deduplication
const pendingRequests = new Map<string, Promise<any>>();

export const deduplicateRequests = (keyFn: (req: Request) => string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    
    // Check if identical request is already in progress
    const pending = pendingRequests.get(key);
    if (pending) {
      try {
        const result = await pending;
        return res.json(result);
      } catch (error) {
        // If pending request failed, continue with new request
      }
    }
    
    // Create promise for this request
    const promise = new Promise((resolve, reject) => {
      const originalJson = res.json.bind(res);
      
      res.json = function(body: any) {
        pendingRequests.delete(key);
        resolve(body);
        return originalJson(body);
      };
      
      // Handle errors
      const originalNext = next;
      next = (error?: any) => {
        if (error) {
          pendingRequests.delete(key);
          reject(error);
        }
        originalNext(error);
      };
    });
    
    pendingRequests.set(key, promise);
    next();
  };
};

// Lazy loading middleware
export const lazyLoadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Add pagination defaults
  if (!req.query.limit) {
    req.query.limit = '20';
  }
  if (!req.query.offset) {
    req.query.offset = '0';
  }
  
  // Add field selection support
  if (req.query.fields) {
    (req as any).selectedFields = (req.query.fields as string).split(',');
  }
  
  next();
};