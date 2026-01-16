/**
 * Network Logs Tool
 *
 * MCP tool for capturing and retrieving network requests/responses.
 * Essential for debugging, API verification, and performance analysis.
 */

import { z } from 'zod';
import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import {
  NetworkMonitoringService,
  NetworkMonitoringOptionsSchema,
  NetworkLogsResult,
  NetworkRequest
} from '../services/network-monitoring-service.js';

export type NetworkLogsInput = z.infer<typeof NetworkMonitoringOptionsSchema>;

/**
 * Network Logs Tool
 *
 * Captures network requests and responses for debugging and API verification.
 */
export class NetworkLogsTool implements MCPTool {
  name = 'get_network_logs';
  description = 'Capture network requests and responses for debugging and API verification. Supports filtering by URL pattern, HTTP method, status code, and resource type. Essential for understanding API calls and debugging network issues.';
  inputSchema = NetworkMonitoringOptionsSchema;

  private networkService: NetworkMonitoringService;

  constructor() {
    this.networkService = new NetworkMonitoringService();
  }

  async execute(args: NetworkLogsInput): Promise<CallToolResult> {
    const startTime = Date.now();

    try {
      await this.networkService.initialize();
      const result = await this.networkService.captureNetworkLogs(args);

      return this.formatResult(result, args);

    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Failed to capture network logs: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    } finally {
      await this.networkService.close();
    }
  }

  /**
   * Format result for MCP response
   */
  private formatResult(result: NetworkLogsResult, args: NetworkLogsInput): CallToolResult {
    const content: CallToolResult['content'] = [];

    // Header
    const hasErrors = result.summary.failedRequests > 0;
    const status = hasErrors ? 'ERRORS DETECTED' : 'SUCCESS';

    let headerText = `Network Logs Capture: ${status}\n\n`;
    headerText += `Page: ${result.pageInfo.title}\n`;
    headerText += `URL: ${result.pageInfo.url}\n`;
    if (result.pageInfo.loadTime) {
      headerText += `Page Load Time: ${result.pageInfo.loadTime}ms\n`;
    }
    headerText += `Capture Time: ${result.captureTime}ms\n`;

    content.push({
      type: 'text',
      text: headerText
    });

    // Summary section
    const { summary } = result;
    let summaryText = `\n## Summary\n\n`;
    summaryText += `- **Total Requests:** ${summary.totalRequests}\n`;
    summaryText += `- **Successful:** ${summary.successfulRequests}\n`;
    summaryText += `- **Failed:** ${summary.failedRequests}\n`;
    summaryText += `- **Data Transferred:** ${this.formatBytes(summary.totalDataTransferred)}\n`;
    if (summary.averageResponseTime > 0) {
      summaryText += `- **Avg Response Time:** ${summary.averageResponseTime}ms\n`;
    }

    // By method
    if (Object.keys(summary.byMethod).length > 0) {
      summaryText += `\n### By Method\n`;
      Object.entries(summary.byMethod)
        .sort(([, a], [, b]) => b - a)
        .forEach(([method, count]) => {
          summaryText += `- ${method}: ${count}\n`;
        });
    }

    // By status
    if (Object.keys(summary.byStatus).length > 0) {
      summaryText += `\n### By Status\n`;
      Object.entries(summary.byStatus)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([status, count]) => {
          summaryText += `- ${status}: ${count}\n`;
        });
    }

    // By resource type
    if (Object.keys(summary.byResourceType).length > 0) {
      summaryText += `\n### By Resource Type\n`;
      Object.entries(summary.byResourceType)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          summaryText += `- ${type}: ${count}\n`;
        });
    }

    content.push({
      type: 'text',
      text: summaryText
    });

    // Failed requests (highlighted)
    const failedRequests = result.requests.filter(r => r.status && r.status >= 400);
    if (failedRequests.length > 0) {
      let failedText = `\n## Failed Requests (${failedRequests.length})\n\n`;
      failedRequests.slice(0, 10).forEach((req, index) => {
        failedText += `${index + 1}. **[${req.method}] ${req.status}** ${this.truncateUrl(req.url, 60)}\n`;
        if (req.error) {
          failedText += `   Error: ${req.error}\n`;
        }
      });
      if (failedRequests.length > 10) {
        failedText += `   ... and ${failedRequests.length - 10} more failed requests\n`;
      }
      content.push({
        type: 'text',
        text: failedText
      });
    }

    // All requests (limited view)
    if (result.requests.length > 0) {
      let requestsText = `\n## Requests (showing first 20 of ${result.requests.length})\n\n`;
      result.requests.slice(0, 20).forEach((req, index) => {
        const statusIcon = this.getStatusIcon(req.status);
        const size = req.size ? this.formatBytes(req.size.requestSize + req.size.responseSize) : '?';
        requestsText += `${index + 1}. ${statusIcon} [${req.method}] ${req.status || '?'} ${this.truncateUrl(req.url, 50)} (${size})\n`;
      });
      if (result.requests.length > 20) {
        requestsText += `\n... and ${result.requests.length - 20} more requests (see full data below)\n`;
      }
      content.push({
        type: 'text',
        text: requestsText
      });
    } else {
      content.push({
        type: 'text',
        text: '\n## Requests\n\nNo network requests captured.\n'
      });
    }

    // API requests (XHR/fetch) highlighted
    const apiRequests = result.requests.filter(r => r.resourceType === 'xhr' || r.resourceType === 'fetch');
    if (apiRequests.length > 0) {
      let apiText = `\n## API Requests (${apiRequests.length})\n\n`;
      apiRequests.slice(0, 10).forEach((req, index) => {
        apiText += `${index + 1}. **[${req.method}] ${req.status || '?'}** ${this.truncateUrl(req.url, 60)}\n`;
        if (args.includeBody && req.responseBody) {
          const bodyPreview = req.responseBody.substring(0, 100);
          apiText += `   Response: ${bodyPreview}${req.responseBody.length > 100 ? '...' : ''}\n`;
        }
      });
      if (apiRequests.length > 10) {
        apiText += `   ... and ${apiRequests.length - 10} more API requests\n`;
      }
      content.push({
        type: 'text',
        text: apiText
      });
    }

    // Filter information
    if (args.filter) {
      let filterText = `\n## Applied Filters\n`;
      if (args.filter.urlPattern) {
        filterText += `- URL Pattern: ${args.filter.urlPattern}\n`;
      }
      if (args.filter.methods) {
        filterText += `- Methods: ${args.filter.methods.join(', ')}\n`;
      }
      if (args.filter.statusCodes) {
        filterText += `- Status Codes: ${args.filter.statusCodes.join(', ')}\n`;
      }
      if (args.filter.resourceTypes) {
        filterText += `- Resource Types: ${args.filter.resourceTypes.join(', ')}\n`;
      }
      content.push({
        type: 'text',
        text: filterText
      });
    }

    // Full JSON data
    content.push({
      type: 'text',
      text: `\n## Full Data\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
    });

    return { content };
  }

  /**
   * Get status icon based on HTTP status code
   */
  private getStatusIcon(status?: number): string {
    if (!status) return '?';
    if (status >= 200 && status < 300) return 'OK';
    if (status >= 300 && status < 400) return 'REDIRECT';
    if (status >= 400 && status < 500) return 'CLIENT_ERROR';
    if (status >= 500) return 'SERVER_ERROR';
    return '?';
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Truncate URL for display
   */
  private truncateUrl(url: string, maxLength: number = 60): string {
    if (url.length <= maxLength) return url;
    const start = url.substring(0, maxLength - 3);
    return start + '...';
  }

  /**
   * Quick method to capture all network requests
   */
  async captureAll(url: string): Promise<CallToolResult> {
    return this.execute({
      url,
      waitTime: 5000,
      browser: 'chrome:headless',
      includeHeaders: true,
      includeBody: false,
      maxBodySize: 10240,
      maxLogs: 100
    });
  }

  /**
   * Quick method to capture only API requests
   */
  async captureApiRequests(url: string): Promise<CallToolResult> {
    return this.execute({
      url,
      waitTime: 5000,
      browser: 'chrome:headless',
      includeHeaders: true,
      includeBody: true,
      maxBodySize: 10240,
      maxLogs: 50,
      filter: {
        resourceTypes: ['xhr', 'fetch']
      }
    });
  }

  /**
   * Quick method to capture only failed requests
   */
  async captureFailedRequests(url: string): Promise<CallToolResult> {
    return this.execute({
      url,
      waitTime: 5000,
      browser: 'chrome:headless',
      includeHeaders: true,
      includeBody: true,
      maxBodySize: 10240,
      maxLogs: 50,
      filter: {
        statusCodes: [400, 401, 403, 404, 500, 502, 503, 504]
      }
    });
  }

  /**
   * Quick method to check for network errors
   */
  async checkForErrors(url: string): Promise<CallToolResult> {
    const result = await this.execute({
      url,
      waitTime: 5000,
      browser: 'chrome:headless',
      includeHeaders: false,
      includeBody: false,
      maxBodySize: 10240,
      maxLogs: 200
    });

    return result;
  }
}
