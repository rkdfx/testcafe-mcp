/**
 * Performance Monitor Service
 * 
 * Monitors and tracks performance metrics for TestCafe operations.
 */

export interface PerformanceMetrics {
  testExecutionTime: number;
  browserLaunchTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  testCount: number;
  errorRate: number;
  timestamp: number;
}

export interface PerformanceReport {
  averageExecutionTime: number;
  averageBrowserLaunchTime: number;
  peakMemoryUsage: number;
  totalTests: number;
  successRate: number;
  timeRange: {
    start: number;
    end: number;
  };
  recommendations: string[];
}

/**
 * Performance Monitor
 * 
 * Tracks and analyzes performance metrics for optimization.
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsHistory = 1000;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Record performance metrics
   */
  recordMetrics(metrics: Partial<PerformanceMetrics>): void {
    const fullMetrics: PerformanceMetrics = {
      testExecutionTime: 0,
      browserLaunchTime: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: this.getCpuUsage(),
      testCount: 0,
      errorRate: 0,
      timestamp: Date.now(),
      ...metrics
    };

    this.metrics.push(fullMetrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport(timeRangeMs?: number): PerformanceReport {
    const now = Date.now();
    const startTime = timeRangeMs ? now - timeRangeMs : this.startTime;
    
    const relevantMetrics = this.metrics.filter(m => m.timestamp >= startTime);
    
    if (relevantMetrics.length === 0) {
      return this.getEmptyReport(startTime, now);
    }

    const totalTests = relevantMetrics.reduce((sum, m) => sum + m.testCount, 0);
    const totalErrors = relevantMetrics.reduce((sum, m) => sum + (m.errorRate * m.testCount), 0);
    
    const averageExecutionTime = this.calculateAverage(relevantMetrics, 'testExecutionTime');
    const averageBrowserLaunchTime = this.calculateAverage(relevantMetrics, 'browserLaunchTime');
    const peakMemoryUsage = Math.max(...relevantMetrics.map(m => m.memoryUsage.heapUsed));
    
    const successRate = totalTests > 0 ? ((totalTests - totalErrors) / totalTests) * 100 : 100;

    return {
      averageExecutionTime,
      averageBrowserLaunchTime,
      peakMemoryUsage,
      totalTests,
      successRate,
      timeRange: { start: startTime, end: now },
      recommendations: this.generateRecommendations(relevantMetrics)
    };
  }

  /**
   * Get current system metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return {
      testExecutionTime: 0,
      browserLaunchTime: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: this.getCpuUsage(),
      testCount: 0,
      errorRate: 0,
      timestamp: Date.now()
    };
  }

  /**
   * Check if system is under stress
   */
  isSystemUnderStress(): boolean {
    const currentMetrics = this.getCurrentMetrics();
    const memoryUsagePercent = (currentMetrics.memoryUsage.heapUsed / currentMetrics.memoryUsage.heapTotal) * 100;
    
    return (
      memoryUsagePercent > 80 ||
      currentMetrics.cpuUsage > 80
    );
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): string[] {
    const recentMetrics = this.metrics.slice(-10);
    const suggestions: string[] = [];

    if (recentMetrics.length === 0) {
      return suggestions;
    }

    const avgMemory = this.calculateAverage(recentMetrics, 'memoryUsage', 'heapUsed');
    const avgCpu = this.calculateAverage(recentMetrics, 'cpuUsage');
    const avgExecutionTime = this.calculateAverage(recentMetrics, 'testExecutionTime');

    // Memory optimization
    if (avgMemory > 500 * 1024 * 1024) { // 500MB
      suggestions.push('Consider reducing concurrency to lower memory usage');
      suggestions.push('Enable garbage collection between tests');
    }

    // CPU optimization
    if (avgCpu > 70) {
      suggestions.push('Reduce test execution speed to lower CPU usage');
      suggestions.push('Consider running tests in smaller batches');
    }

    // Execution time optimization
    if (avgExecutionTime > 60000) { // 1 minute
      suggestions.push('Use headless browsers for faster execution');
      suggestions.push('Optimize selectors and reduce wait times');
      suggestions.push('Consider parallel test execution');
    }

    return suggestions;
  }

  /**
   * Reset metrics history
   */
  reset(): void {
    this.metrics = [];
    this.startTime = Date.now();
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Calculate average for a metric
   */
  private calculateAverage(
    metrics: PerformanceMetrics[], 
    field: keyof PerformanceMetrics,
    subField?: string
  ): number {
    if (metrics.length === 0) return 0;

    const values = metrics.map(m => {
      const value = m[field];
      if (subField && typeof value === 'object' && value !== null) {
        return (value as any)[subField] || 0;
      }
      return typeof value === 'number' ? value : 0;
    });

    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Get CPU usage percentage
   */
  private getCpuUsage(): number {
    const usage = process.cpuUsage();
    const totalUsage = usage.user + usage.system;
    
    // Convert to percentage (rough approximation)
    return Math.min(100, (totalUsage / 1000000) * 100);
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: PerformanceMetrics[]): string[] {
    const recommendations: string[] = [];

    if (metrics.length === 0) {
      return recommendations;
    }

    const avgExecutionTime = this.calculateAverage(metrics, 'testExecutionTime');
    const avgMemory = this.calculateAverage(metrics, 'memoryUsage', 'heapUsed');
    const avgCpu = this.calculateAverage(metrics, 'cpuUsage');
    const totalTests = metrics.reduce((sum, m) => sum + m.testCount, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + (m.errorRate * m.testCount), 0);
    const errorRate = totalTests > 0 ? (totalErrors / totalTests) * 100 : 0;

    // Performance recommendations
    if (avgExecutionTime > 30000) {
      recommendations.push('Consider using headless browsers to improve execution speed');
    }

    if (avgMemory > 1024 * 1024 * 1024) { // 1GB
      recommendations.push('High memory usage detected - consider reducing concurrency');
    }

    if (avgCpu > 80) {
      recommendations.push('High CPU usage - consider reducing test execution speed');
    }

    // Reliability recommendations
    if (errorRate > 10) {
      recommendations.push('High error rate detected - review test stability and selectors');
    }

    if (errorRate > 25) {
      recommendations.push('Very high error rate - consider enabling quarantine mode');
    }

    // Optimization recommendations
    if (totalTests > 100 && avgExecutionTime < 10000) {
      recommendations.push('Good performance - consider increasing concurrency for faster overall execution');
    }

    return recommendations;
  }

  /**
   * Get empty report for when no metrics are available
   */
  private getEmptyReport(startTime: number, endTime: number): PerformanceReport {
    return {
      averageExecutionTime: 0,
      averageBrowserLaunchTime: 0,
      peakMemoryUsage: 0,
      totalTests: 0,
      successRate: 100,
      timeRange: { start: startTime, end: endTime },
      recommendations: ['No performance data available yet']
    };
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();