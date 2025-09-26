import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import redis from '../services/redis';

const router = Router();
const prisma = new PrismaClient();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: {
      status: 'up' | 'down';
      latency?: number;
    };
    redis: {
      status: 'up' | 'down';
      latency?: number;
    };
    storage: {
      status: 'up' | 'down';
    };
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

// Health check endpoint
router.get('/health', async (req, res) => {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: { status: 'down' },
      redis: { status: 'down' },
      storage: { status: 'down' }
    },
    memory: {
      used: 0,
      total: 0,
      percentage: 0
    }
  };

  try {
    // Check database
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.services.database.status = 'up';
    health.services.database.latency = Date.now() - dbStart;
  } catch (error) {
    console.error('Database health check failed:', error);
    health.status = 'unhealthy';
  }

  try {
    // Check Redis
    const redisStart = Date.now();
    await redis.ping();
    health.services.redis.status = 'up';
    health.services.redis.latency = Date.now() - redisStart;
  } catch (error) {
    console.error('Redis health check failed:', error);
    health.status = 'unhealthy';
  }

  try {
    // Check storage (simplified - in production, check actual S3/storage service)
    health.services.storage.status = 'up';
  } catch (error) {
    console.error('Storage health check failed:', error);
    health.status = 'unhealthy';
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  health.memory = {
    used: Math.round(memUsage.heapUsed / 1024 / 1024),
    total: Math.round(memUsage.heapTotal / 1024 / 1024),
    percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Readiness check endpoint
router.get('/ready', async (req, res) => {
  try {
    // Check if all critical services are ready
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Metrics endpoint for Prometheus
router.get('/metrics', (req, res) => {
  const metrics = [];
  
  // Process metrics
  const memUsage = process.memoryUsage();
  metrics.push(`# HELP nodejs_heap_size_total_bytes Process heap size`);
  metrics.push(`# TYPE nodejs_heap_size_total_bytes gauge`);
  metrics.push(`nodejs_heap_size_total_bytes ${memUsage.heapTotal}`);
  
  metrics.push(`# HELP nodejs_heap_size_used_bytes Process heap size used`);
  metrics.push(`# TYPE nodejs_heap_size_used_bytes gauge`);
  metrics.push(`nodejs_heap_size_used_bytes ${memUsage.heapUsed}`);
  
  metrics.push(`# HELP nodejs_process_uptime_seconds Process uptime`);
  metrics.push(`# TYPE nodejs_process_uptime_seconds gauge`);
  metrics.push(`nodejs_process_uptime_seconds ${process.uptime()}`);
  
  // Custom application metrics
  metrics.push(`# HELP chittychat_active_sessions Number of active user sessions`);
  metrics.push(`# TYPE chittychat_active_sessions gauge`);
  metrics.push(`chittychat_active_sessions ${global.activeSessions || 0}`);
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics.join('\n'));
});

export default router;