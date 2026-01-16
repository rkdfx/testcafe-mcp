/**
 * Network Monitoring Service
 *
 * Provides network request/response capture functionality for debugging and API verification.
 * Uses TestCafe's RequestLogger to intercept and capture network traffic.
 */

import { z } from 'zod';

/**
 * Network request information
 */
export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  resourceType?: string;
  timestamp: number;
  duration?: number;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  size?: {
    requestSize: number;
    responseSize: number;
  };
  error?: string;
}

/**
 * Network logs result
 */
export interface NetworkLogsResult {
  requests: NetworkRequest[];
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    byMethod: Record<string, number>;
    byStatus: Record<string, number>;
    byResourceType: Record<string, number>;
    totalDataTransferred: number;
    averageResponseTime: number;
  };
  captureTime: number;
  pageInfo: {
    url: string;
    title: string;
    loadTime?: number;
  };
}

/**
 * Network filter options
 */
export const NetworkFilterSchema = z.object({
  urlPattern: z.string().optional().describe('Regex pattern to filter by URL'),
  methods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])).optional().describe('Filter by HTTP methods'),
  statusCodes: z.array(z.number()).optional().describe('Filter by status codes'),
  resourceTypes: z.array(z.enum(['document', 'script', 'stylesheet', 'image', 'font', 'xhr', 'fetch', 'websocket', 'other'])).optional().describe('Filter by resource types')
});

/**
 * Network monitoring options schema
 */
export const NetworkMonitoringOptionsSchema = z.object({
  url: z.string().url().describe('The URL to navigate to and capture network logs'),
  filter: NetworkFilterSchema.optional().describe('Filters for network requests'),
  waitTime: z.number().min(100).max(60000).default(5000).describe('Time to wait for requests in ms'),
  browser: z.string().default('chrome:headless').describe('Browser to use'),
  includeHeaders: z.boolean().default(true).describe('Include request/response headers'),
  includeBody: z.boolean().default(false).describe('Include request/response body'),
  maxBodySize: z.number().min(0).max(1048576).default(10240).describe('Max body size to capture in bytes'),
  maxLogs: z.number().min(1).max(1000).default(100).describe('Maximum number of logs to return')
});

export type NetworkMonitoringOptions = z.infer<typeof NetworkMonitoringOptionsSchema>;

/**
 * Network Monitoring Service
 *
 * Handles network request capture using TestCafe's RequestLogger.
 */
export class NetworkMonitoringService {
  private testCafeInstance: any = null;

  /**
   * Initialize the network monitoring service with TestCafe instance
   */
  async initialize(testCafeInstance?: any): Promise<void> {
    if (testCafeInstance) {
      this.testCafeInstance = testCafeInstance;
    } else {
      const createTestCafe = (await import('testcafe')).default;
      this.testCafeInstance = await createTestCafe('localhost', 1343, 1344);
    }
  }

  /**
   * Close the network monitoring service
   */
  async close(): Promise<void> {
    if (this.testCafeInstance) {
      await this.testCafeInstance.close();
      this.testCafeInstance = null;
    }
  }

  /**
   * Capture network logs from a page
   */
  async captureNetworkLogs(options: NetworkMonitoringOptions): Promise<NetworkLogsResult> {
    const startTime = Date.now();

    if (!this.testCafeInstance) {
      await this.initialize();
    }

    const testCode = this.generateNetworkCaptureCode(options);
    const tempFile = await this.createTempTestFile(testCode);

    try {
      const result = await this.executeNetworkCapture(tempFile, options);
      return {
        ...result,
        captureTime: Date.now() - startTime
      };
    } finally {
      await this.cleanupTempFile(tempFile);
    }
  }

  /**
   * Generate TestCafe code for network capture using RequestLogger
   */
  private generateNetworkCaptureCode(options: NetworkMonitoringOptions): string {
    const filterFunction = this.buildRequestFilter(options.filter);
    const includeHeaders = options.includeHeaders ? 'true' : 'false';
    const includeBody = options.includeBody ? 'true' : 'false';
    const maxBodySize = options.maxBodySize;
    const maxLogs = options.maxLogs;

    return `import { RequestLogger, Selector } from 'testcafe';

// Create request logger with filter and options
const logger = RequestLogger(
  ${filterFunction},
  {
    logRequestHeaders: ${includeHeaders},
    logResponseHeaders: ${includeHeaders},
    logRequestBody: ${includeBody},
    logResponseBody: ${includeBody},
    stringifyRequestBody: true,
    stringifyResponseBody: true
  }
);

fixture('Network Monitoring')
  .page('${this.escapeString(options.url)}')
  .requestHooks(logger);

test('Capture Network Logs', async t => {
  // Wait for page to load
  await t.wait(1000);

  // Wait for document ready state
  await t.expect(Selector(() => document.readyState === 'complete').exists).ok('Page should be ready', {
    timeout: 30000
  });

  // Wait for network activity to settle
  await t.wait(${options.waitTime});

  // Get page info
  const pageInfo = await t.eval(() => {
    return {
      url: window.location.href,
      title: document.title,
      loadTime: performance.timing ? (performance.timing.loadEventEnd - performance.timing.navigationStart) : null
    };
  });

  // Process captured requests
  const requests = logger.requests.slice(0, ${maxLogs}).map((req, index) => {
    const requestInfo = {
      id: 'req_' + Date.now() + '_' + index,
      url: req.request.url,
      method: req.request.method,
      timestamp: req.request.timestamp || Date.now(),
      status: req.response ? req.response.statusCode : undefined,
      statusText: req.response ? req.response.statusMessage : undefined
    };

    // Add headers if requested
    if (${includeHeaders}) {
      requestInfo.requestHeaders = req.request.headers || {};
      requestInfo.responseHeaders = req.response ? req.response.headers : {};
    }

    // Add body if requested (with size limit)
    if (${includeBody}) {
      if (req.request.body) {
        const reqBody = typeof req.request.body === 'string' ? req.request.body : JSON.stringify(req.request.body);
        requestInfo.requestBody = reqBody.length <= ${maxBodySize}
          ? reqBody
          : reqBody.substring(0, ${maxBodySize}) + '...[truncated]';
      }

      if (req.response && req.response.body) {
        const resBody = typeof req.response.body === 'string' ? req.response.body : JSON.stringify(req.response.body);
        requestInfo.responseBody = resBody.length <= ${maxBodySize}
          ? resBody
          : resBody.substring(0, ${maxBodySize}) + '...[truncated]';
      }
    }

    // Add size information
    requestInfo.size = {
      requestSize: req.request.body ? (typeof req.request.body === 'string' ? req.request.body.length : JSON.stringify(req.request.body).length) : 0,
      responseSize: req.response && req.response.body ? (typeof req.response.body === 'string' ? req.response.body.length : JSON.stringify(req.response.body).length) : 0
    };

    // Determine resource type from headers or URL
    const contentType = req.response && req.response.headers ? (req.response.headers['content-type'] || '') : '';
    if (contentType.includes('text/html')) {
      requestInfo.resourceType = 'document';
    } else if (contentType.includes('javascript')) {
      requestInfo.resourceType = 'script';
    } else if (contentType.includes('css')) {
      requestInfo.resourceType = 'stylesheet';
    } else if (contentType.includes('image')) {
      requestInfo.resourceType = 'image';
    } else if (contentType.includes('font')) {
      requestInfo.resourceType = 'font';
    } else if (req.request.url.includes('/api/') || contentType.includes('json')) {
      requestInfo.resourceType = 'xhr';
    } else {
      requestInfo.resourceType = 'other';
    }

    return requestInfo;
  });

  // Calculate summary statistics
  const summary = {
    totalRequests: requests.length,
    successfulRequests: requests.filter(r => r.status && r.status >= 200 && r.status < 400).length,
    failedRequests: requests.filter(r => r.status && r.status >= 400).length,
    byMethod: {},
    byStatus: {},
    byResourceType: {},
    totalDataTransferred: 0,
    averageResponseTime: 0
  };

  requests.forEach(req => {
    // Count by method
    summary.byMethod[req.method] = (summary.byMethod[req.method] || 0) + 1;

    // Count by status
    if (req.status) {
      const statusGroup = Math.floor(req.status / 100) + 'xx';
      summary.byStatus[statusGroup] = (summary.byStatus[statusGroup] || 0) + 1;
    }

    // Count by resource type
    if (req.resourceType) {
      summary.byResourceType[req.resourceType] = (summary.byResourceType[req.resourceType] || 0) + 1;
    }

    // Sum data transferred
    if (req.size) {
      summary.totalDataTransferred += req.size.requestSize + req.size.responseSize;
    }
  });

  const result = {
    requests,
    summary,
    pageInfo
  };

  console.log('NETWORK_LOGS_RESULT:', JSON.stringify(result));
});`;
  }

  /**
   * Build request filter function string for RequestLogger
   */
  private buildRequestFilter(filter?: NetworkMonitoringOptions['filter']): string {
    if (!filter) {
      return 'request => true';
    }

    const conditions: string[] = [];

    if (filter.urlPattern) {
      conditions.push(`new RegExp('${this.escapeString(filter.urlPattern)}').test(request.url)`);
    }

    if (filter.methods && filter.methods.length > 0) {
      const methodList = filter.methods.map(m => `'${m}'`).join(', ');
      conditions.push(`[${methodList}].includes(request.method.toUpperCase())`);
    }

    if (conditions.length === 0) {
      return 'request => true';
    }

    return `request => ${conditions.join(' && ')}`;
  }

  /**
   * Execute network capture in TestCafe
   */
  private async executeNetworkCapture(
    tempFile: string,
    options: NetworkMonitoringOptions
  ): Promise<Omit<NetworkLogsResult, 'captureTime'>> {
    const runner = this.testCafeInstance.createRunner();
    runner.src(tempFile);
    runner.browsers([options.browser || 'chrome:headless']);

    let capturedOutput = '';
    const originalLog = console.log;

    console.log = (...args: any[]) => {
      const message = args.join(' ');
      capturedOutput += message + '\n';
    };

    try {
      await runner.run({
        skipJsErrors: true,
        skipUncaughtErrors: true,
        quarantineMode: false,
        selectorTimeout: 5000,
        assertionTimeout: 5000,
        pageLoadTimeout: 30000
      });
    } finally {
      console.log = originalLog;
    }

    // Parse result from output
    const resultMatch = capturedOutput.match(/NETWORK_LOGS_RESULT: (.+)/);
    if (resultMatch) {
      try {
        const parsed = JSON.parse(resultMatch[1]);

        // Apply status code filter if specified (can't do this in RequestLogger)
        if (options.filter?.statusCodes && options.filter.statusCodes.length > 0) {
          parsed.requests = parsed.requests.filter((req: NetworkRequest) =>
            req.status && options.filter!.statusCodes!.includes(req.status)
          );
          // Recalculate summary after filtering
          parsed.summary = this.calculateSummary(parsed.requests);
        }

        // Apply resource type filter if specified
        if (options.filter?.resourceTypes && options.filter.resourceTypes.length > 0) {
          parsed.requests = parsed.requests.filter((req: NetworkRequest) =>
            req.resourceType && options.filter!.resourceTypes!.includes(req.resourceType as any)
          );
          parsed.summary = this.calculateSummary(parsed.requests);
        }

        return {
          requests: parsed.requests,
          summary: parsed.summary,
          pageInfo: parsed.pageInfo
        };
      } catch (error) {
        throw new Error(`Failed to parse network logs: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error('No network logs result captured');
  }

  /**
   * Calculate summary statistics from requests
   */
  private calculateSummary(requests: NetworkRequest[]): NetworkLogsResult['summary'] {
    const summary: NetworkLogsResult['summary'] = {
      totalRequests: requests.length,
      successfulRequests: 0,
      failedRequests: 0,
      byMethod: {},
      byStatus: {},
      byResourceType: {},
      totalDataTransferred: 0,
      averageResponseTime: 0
    };

    let totalDuration = 0;
    let durationCount = 0;

    requests.forEach(req => {
      // Count successful/failed
      if (req.status) {
        if (req.status >= 200 && req.status < 400) {
          summary.successfulRequests++;
        } else if (req.status >= 400) {
          summary.failedRequests++;
        }
      }

      // Count by method
      summary.byMethod[req.method] = (summary.byMethod[req.method] || 0) + 1;

      // Count by status
      if (req.status) {
        const statusGroup = Math.floor(req.status / 100) + 'xx';
        summary.byStatus[statusGroup] = (summary.byStatus[statusGroup] || 0) + 1;
      }

      // Count by resource type
      if (req.resourceType) {
        summary.byResourceType[req.resourceType] = (summary.byResourceType[req.resourceType] || 0) + 1;
      }

      // Sum data transferred
      if (req.size) {
        summary.totalDataTransferred += req.size.requestSize + req.size.responseSize;
      }

      // Sum duration
      if (req.duration) {
        totalDuration += req.duration;
        durationCount++;
      }
    });

    summary.averageResponseTime = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

    return summary;
  }

  /**
   * Generate network monitoring code for manual use
   */
  generateNetworkMonitoringCode(options: Partial<NetworkMonitoringOptions>): string {
    const validatedOptions = NetworkMonitoringOptionsSchema.parse({
      url: options.url || 'about:blank',
      ...options
    });
    return this.generateNetworkCaptureCode(validatedOptions);
  }

  /**
   * Create temporary test file
   */
  private async createTempTestFile(testCode: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testcafe-network-'));
    const tempFile = path.join(tempDir, 'network-monitoring-test.js');

    await fs.writeFile(tempFile, testCode, 'utf8');
    return tempFile;
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      await fs.unlink(filePath);

      const dir = path.dirname(filePath);
      try {
        await fs.rmdir(dir);
      } catch {
        // Directory not empty or other error, ignore
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Escape string for JavaScript
   */
  private escapeString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }

  /**
   * Format bytes to human-readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
