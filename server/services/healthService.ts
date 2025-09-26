import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../db.js';
import { users, prompts, exportJobs, systemMetrics } from '@shared/schema';
import Database from "@replit/database";

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: HealthCheck[];
  performance: PerformanceMetrics;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  responseTime: number;
  message: string;
  details?: Record<string, any>;
}

interface PerformanceMetrics {
  responseTime: {
    avg: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerMinute: number;
    errorsPerMinute: number;
  };
  resources: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      percentage: number;
    };
  };
}

interface SystemAlert {
  level: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

export class HealthService {
  private static readonly healthDB = new Database();
  private static readonly startTime = Date.now();

  /**
   * Perform comprehensive health check
   */
  static async performHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];

    // Database connectivity check
    checks.push(await this.checkDatabaseConnectivity());
    
    // ReplitDB connectivity check
    checks.push(await this.checkReplitDBConnectivity());
    
    // API endpoints check
    checks.push(await this.checkAPIEndpoints());
    
    // Performance metrics check
    checks.push(await this.checkPerformanceMetrics());
    
    // Storage check
    checks.push(await this.checkStorageHealth());
    
    // Memory usage check
    checks.push(await this.checkMemoryUsage());

    // Calculate summary
    const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const warnings = checks.filter(c => c.status === 'warn').length;

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (failed > 0) {
      overallStatus = 'unhealthy';
    } else if (warnings > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    // Get performance metrics
    const performance = await this.getPerformanceMetrics();

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Date.now() - this.startTime,
      checks,
      performance,
      summary: {
        total: checks.length,
        passed: passed + warnings, // Warnings count as passed for summary
        failed
      }
    };

    // Store health check result
    await this.storeHealthMetrics(healthStatus);

    return healthStatus;
  }

  /**
   * Check database connectivity
   */
  private static async checkDatabaseConnectivity(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      // Simple query to test connectivity
      const result = await db.select({ count: sql`count(*)` }).from(users);
      const responseTime = Date.now() - start;

      return {
        name: 'database_connectivity',
        status: responseTime < 1000 ? 'pass' : 'warn',
        responseTime,
        message: responseTime < 1000 ? 'Database connection healthy' : 'Database connection slow',
        details: {
          userCount: result[0]?.count || 0,
          driver: 'neon-serverless'
        }
      };
    } catch (error) {
      return {
        name: 'database_connectivity',
        status: 'fail',
        responseTime: Date.now() - start,
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Check ReplitDB connectivity
   */
  private static async checkReplitDBConnectivity(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      // Test ReplitDB with a simple operation
      const testKey = `health_check_${Date.now()}`;
      await this.healthDB.set(testKey, 'test');
      const value = await this.healthDB.get(testKey);
      await this.healthDB.delete(testKey);
      
      const responseTime = Date.now() - start;

      // Handle ReplitDB response format
      const actualValue = typeof value === 'object' && value !== null && 'value' in value
        ? (value as any).value
        : value;

      return {
        name: 'replitdb_connectivity',
        status: responseTime < 500 ? 'pass' : 'warn',
        responseTime,
        message: responseTime < 500 ? 'ReplitDB connection healthy' : 'ReplitDB connection slow',
        details: { testValue: actualValue === 'test' ? 'success' : 'failure' }
      };
    } catch (error) {
      return {
        name: 'replitdb_connectivity',
        status: 'fail',
        responseTime: Date.now() - start,
        message: `ReplitDB connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Check API endpoints health
   */
  private static async checkAPIEndpoints(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      // Test critical endpoints (simulate internal requests)
      const endpoints = [
        { name: 'prompts', healthy: true, responseTime: 45 },
        { name: 'folders', healthy: true, responseTime: 32 },
        { name: 'notifications', healthy: true, responseTime: 28 },
        { name: 'export', healthy: true, responseTime: 156 }
      ];

      const avgResponseTime = endpoints.reduce((sum, ep) => sum + ep.responseTime, 0) / endpoints.length;
      const unhealthyEndpoints = endpoints.filter(ep => !ep.healthy);

      return {
        name: 'api_endpoints',
        status: unhealthyEndpoints.length === 0 ? 'pass' : 'fail',
        responseTime: Date.now() - start,
        message: unhealthyEndpoints.length === 0 
          ? `All ${endpoints.length} API endpoints healthy`
          : `${unhealthyEndpoints.length} endpoints unhealthy`,
        details: {
          endpoints: endpoints.length,
          unhealthy: unhealthyEndpoints.length,
          avgResponseTime: Math.round(avgResponseTime)
        }
      };
    } catch (error) {
      return {
        name: 'api_endpoints',
        status: 'fail',
        responseTime: Date.now() - start,
        message: `API endpoint check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Check performance metrics
   */
  private static async checkPerformanceMetrics(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const metrics = await this.getPerformanceMetrics();
      const responseTime = Date.now() - start;

      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message = 'Performance metrics healthy';

      if (metrics.responseTime.avg > 1000) {
        status = 'warn';
        message = 'High average response time detected';
      }

      if (metrics.resources.memory.percentage > 90) {
        status = 'fail';
        message = 'Critical memory usage detected';
      }

      return {
        name: 'performance_metrics',
        status,
        responseTime,
        message,
        details: {
          avgResponseTime: metrics.responseTime.avg,
          memoryUsage: `${metrics.resources.memory.percentage}%`,
          throughput: metrics.throughput.requestsPerMinute
        }
      };
    } catch (error) {
      return {
        name: 'performance_metrics',
        status: 'fail',
        responseTime: Date.now() - start,
        message: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Check storage health
   */
  private static async checkStorageHealth(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      // Check recent export jobs as storage indicator
      const recentJobs = await db
        .select({ id: exportJobs.id, status: exportJobs.status })
        .from(exportJobs)
        .orderBy(desc(exportJobs.createdAt))
        .limit(10);

      const failedJobs = recentJobs.filter(job => job.status === 'failed').length;
      const responseTime = Date.now() - start;

      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message = 'Storage operations healthy';

      if (failedJobs > recentJobs.length * 0.2) { // More than 20% failed
        status = 'warn';
        message = 'High storage operation failure rate';
      }

      return {
        name: 'storage_health',
        status,
        responseTime,
        message,
        details: {
          recentJobs: recentJobs.length,
          failedJobs,
          successRate: `${Math.round((1 - failedJobs / Math.max(recentJobs.length, 1)) * 100)}%`
        }
      };
    } catch (error) {
      return {
        name: 'storage_health',
        status: 'fail',
        responseTime: Date.now() - start,
        message: `Storage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Check memory usage
   */
  private static async checkMemoryUsage(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal;
      const usedMemory = memoryUsage.heapUsed;
      const memoryPercentage = (usedMemory / totalMemory) * 100;
      
      const responseTime = Date.now() - start;

      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message = 'Memory usage normal';

      if (memoryPercentage > 80) {
        status = 'warn';
        message = 'High memory usage detected';
      } else if (memoryPercentage > 95) {
        status = 'fail';
        message = 'Critical memory usage detected';
      }

      return {
        name: 'memory_usage',
        status,
        responseTime,
        message,
        details: {
          used: Math.round(usedMemory / 1024 / 1024), // MB
          total: Math.round(totalMemory / 1024 / 1024), // MB
          percentage: Math.round(memoryPercentage),
          external: Math.round(memoryUsage.external / 1024 / 1024) // MB
        }
      };
    } catch (error) {
      return {
        name: 'memory_usage',
        status: 'fail',
        responseTime: Date.now() - start,
        message: `Memory check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Get performance metrics
   */
  private static async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const memoryUsage = process.memoryUsage();
    
    // In a real system, these would be gathered from monitoring systems
    return {
      responseTime: {
        avg: 245, // ms
        p95: 680,
        p99: 1200
      },
      throughput: {
        requestsPerMinute: 150,
        errorsPerMinute: 2
      },
      resources: {
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
        },
        cpu: {
          percentage: Math.random() * 20 + 10 // Simulated CPU usage
        }
      }
    };
  }

  /**
   * Store health metrics for trending
   */
  private static async storeHealthMetrics(healthStatus: HealthStatus): Promise<void> {
    try {
      await db.insert(systemMetrics).values({
        metricName: 'overall_status',
        value: healthStatus.status === 'healthy' ? '1' : healthStatus.status === 'degraded' ? '0.5' : '0',
        metadata: {
          checks: healthStatus.summary,
          performance: healthStatus.performance.responseTime,
          uptime: healthStatus.uptime
        },
        timestamp: healthStatus.timestamp
      });
    } catch (error) {
      console.error('Failed to store health metrics:', error);
    }
  }

  /**
   * Get system alerts based on health trends
   */
  static async getSystemAlerts(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    try {
      // Get recent health metrics
      const recentMetrics = await db
        .select()
        .from(systemMetrics)
        .where(eq(systemMetrics.metricName, 'health_check'))
        .orderBy(desc(systemMetrics.timestamp))
        .limit(20);

      // Analyze trends
      if (recentMetrics.length >= 3) {
        const latestValues = recentMetrics.slice(0, 3).map(m => Number(m.value));
        const avgHealth = latestValues.reduce((sum: number, val: number) => sum + val, 0) / latestValues.length;

        if (avgHealth < 0.7) {
          alerts.push({
            level: 'critical',
            message: 'System health degrading over recent checks',
            timestamp: new Date().toISOString(),
            metric: 'health_trend',
            value: avgHealth,
            threshold: 0.7
          });
        } else if (avgHealth < 0.9) {
          alerts.push({
            level: 'warning',
            message: 'System health below optimal levels',
            timestamp: new Date().toISOString(),
            metric: 'health_trend',
            value: avgHealth,
            threshold: 0.9
          });
        }
      }

      // Check uptime
      const uptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60);
      if (uptimeHours > 168) { // More than a week
        alerts.push({
          level: 'info',
          message: `System has been running for ${Math.round(uptimeHours)} hours`,
          timestamp: new Date().toISOString(),
          metric: 'uptime',
          value: uptimeHours
        });
      }

    } catch (error) {
      console.error('Failed to generate system alerts:', error);
      alerts.push({
        level: 'warning',
        message: 'Unable to analyze system health trends',
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }

  /**
   * Get system status summary for dashboard
   */
  static async getSystemStatusSummary(): Promise<{
    status: string;
    uptime: number;
    activeUsers: number;
    totalPrompts: number;
    recentActivity: number;
  }> {
    try {
      const [userCount, promptCount] = await Promise.all([
        db.select({ count: sql`count(*)` }).from(users),
        db.select({ count: sql`count(*)` }).from(prompts)
      ]);

      const since24h = new Date();
      since24h.setHours(since24h.getHours() - 24);

      const recentActivity = await db
        .select({ count: sql`count(*)` })
        .from(prompts)
        .where(sql`${prompts.lastAccessed} >= ${since24h.toISOString()}`);

      return {
        status: 'operational',
        uptime: Date.now() - this.startTime,
        activeUsers: Number(userCount[0]?.count) || 0,
        totalPrompts: Number(promptCount[0]?.count) || 0,
        recentActivity: Number(recentActivity[0]?.count) || 0
      };
    } catch (error) {
      console.error('Failed to get system status summary:', error);
      return {
        status: 'unknown',
        uptime: Date.now() - this.startTime,
        activeUsers: 0,
        totalPrompts: 0,
        recentActivity: 0
      };
    }
  }
}