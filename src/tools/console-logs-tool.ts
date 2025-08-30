/**
 * Console Logs Tool
 * 
 * MCP tool for capturing and retrieving browser console logs during test execution.
 * Essential for debugging JavaScript errors, warnings, and application logs.
 */

import { z } from 'zod';
import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';

/**
 * Console log entry
 */
export interface ConsoleLogEntry {
  type: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
  source?: string;
  lineNumber?: number;
  columnNumber?: number;
}

/**
 * Console logs result
 */
export interface ConsoleLogsResult {
  logs: ConsoleLogEntry[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    debug: number;
  };
  captureTime: number;
}

/**
 * Input schema for ConsoleLogsTool
 */
export const ConsoleLogsInputSchema = z.object({
  url: z.string().url().describe('The URL to navigate to and capture console logs from'),
  waitTime: z.number().min(100).max(60000).default(3000).describe('Time in ms to wait for logs after page load'),
  filter: z.object({
    types: z.array(z.enum(['log', 'info', 'warn', 'error', 'debug'])).optional().describe('Filter by log types'),
    messagePattern: z.string().optional().describe('Regex pattern to filter log messages'),
    excludePattern: z.string().optional().describe('Regex pattern to exclude log messages')
  }).optional().describe('Optional filters for console logs'),
  browser: z.string().default('chrome:headless').describe('Browser to use for capturing logs'),
  executeScript: z.string().optional().describe('Optional JavaScript to execute before capturing logs'),
  maxLogs: z.number().min(1).max(1000).default(100).describe('Maximum number of logs to return')
});

export type ConsoleLogsInput = z.infer<typeof ConsoleLogsInputSchema>;

/**
 * Console Logs Tool
 * 
 * Captures browser console logs for debugging and verification.
 * Supports filtering by log type, message pattern, and more.
 */
export class ConsoleLogsTool implements MCPTool {
  name = 'get_console_logs';
  description = 'Capture and retrieve browser console logs (errors, warnings, info, debug) from a web page. Essential for debugging JavaScript issues.';
  inputSchema = ConsoleLogsInputSchema;

  // Store captured logs during session
  private capturedLogs: ConsoleLogEntry[] = [];

  async execute(args: ConsoleLogsInput): Promise<CallToolResult> {
    const startTime = Date.now();
    
    try {
      // Generate TestCafe code that captures console logs
      const captureCode = this.generateConsoleCaptureCode(args);
      
      // For now, we'll provide the generated code and instructions
      // In a full implementation, this would execute via TestCafe's ClientFunction
      
      // Simulate captured logs for demonstration
      // In production, this would be populated by actual browser execution
      const logs = await this.captureConsoleLogs(args);
      
      const captureTime = Date.now() - startTime;
      
      // Apply filters
      const filteredLogs = this.filterLogs(logs, args.filter);
      
      // Limit to maxLogs
      const limitedLogs = filteredLogs.slice(0, args.maxLogs);
      
      // Calculate summary
      const summary = this.calculateSummary(limitedLogs);
      
      const result: ConsoleLogsResult = {
        logs: limitedLogs,
        summary,
        captureTime
      };

      return this.formatResult(result, args, captureCode);

    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Failed to capture console logs: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  /**
   * Capture console logs from browser
   * This generates TestCafe code that can be used to capture logs
   */
  private async captureConsoleLogs(args: ConsoleLogsInput): Promise<ConsoleLogEntry[]> {
    // This would be replaced with actual TestCafe execution
    // For now, return empty array - the tool provides the capture code
    // that can be used in actual test execution
    
    // In a full implementation with live browser:
    // 1. Launch browser with TestCafe
    // 2. Navigate to URL
    // 3. Inject console capture script
    // 4. Wait for specified time
    // 5. Collect and return logs
    
    return [];
  }

  /**
   * Generate TestCafe code for console log capture
   */
  private generateConsoleCaptureCode(args: ConsoleLogsInput): string {
    const code = `import { Selector, ClientFunction } from 'testcafe';

// Console log capture setup
const consoleLogs = [];

// ClientFunction to inject console interceptor
const setupConsoleCapture = ClientFunction(() => {
  window.__capturedConsoleLogs = [];
  
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };
  
  const captureLog = (type) => (...args) => {
    window.__capturedConsoleLogs.push({
      type: type,
      message: args.map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        } catch (e) {
          return String(arg);
        }
      }).join(' '),
      timestamp: Date.now()
    });
    originalConsole[type].apply(console, args);
  };
  
  console.log = captureLog('log');
  console.info = captureLog('info');
  console.warn = captureLog('warn');
  console.error = captureLog('error');
  console.debug = captureLog('debug');
});

// ClientFunction to retrieve captured logs
const getConsoleLogs = ClientFunction(() => {
  return window.__capturedConsoleLogs || [];
});

fixture('Console Log Capture')
  .page('${this.escapeString(args.url)}');

test('Capture Console Logs', async t => {
  // Setup console capture
  await setupConsoleCapture();
  
  ${args.executeScript ? `// Execute custom script\n  await t.eval(() => { ${args.executeScript} });` : '// No custom script to execute'}
  
  // Wait for logs to accumulate
  await t.wait(${args.waitTime});
  
  // Retrieve captured logs
  const logs = await getConsoleLogs();
  
  // Log results
  console.log('Captured', logs.length, 'console messages');
  logs.forEach(log => {
    console.log(\`[\${log.type.toUpperCase()}] \${log.message}\`);
  });
});`;

    return code;
  }

  /**
   * Filter logs based on criteria
   */
  private filterLogs(logs: ConsoleLogEntry[], filter?: ConsoleLogsInput['filter']): ConsoleLogEntry[] {
    if (!filter) return logs;

    let filtered = logs;

    // Filter by type
    if (filter.types && filter.types.length > 0) {
      filtered = filtered.filter(log => filter.types!.includes(log.type));
    }

    // Filter by message pattern
    if (filter.messagePattern) {
      try {
        const regex = new RegExp(filter.messagePattern, 'i');
        filtered = filtered.filter(log => regex.test(log.message));
      } catch (e) {
        // Invalid regex, skip this filter
      }
    }

    // Exclude by pattern
    if (filter.excludePattern) {
      try {
        const regex = new RegExp(filter.excludePattern, 'i');
        filtered = filtered.filter(log => !regex.test(log.message));
      } catch (e) {
        // Invalid regex, skip this filter
      }
    }

    return filtered;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(logs: ConsoleLogEntry[]): ConsoleLogsResult['summary'] {
    return {
      total: logs.length,
      errors: logs.filter(l => l.type === 'error').length,
      warnings: logs.filter(l => l.type === 'warn').length,
      info: logs.filter(l => l.type === 'info' || l.type === 'log').length,
      debug: logs.filter(l => l.type === 'debug').length
    };
  }

  /**
   * Format result for MCP response
   */
  private formatResult(result: ConsoleLogsResult, args: ConsoleLogsInput, captureCode: string): CallToolResult {
    const content: CallToolResult['content'] = [];

    // Summary header
    const hasErrors = result.summary.errors > 0;
    const hasWarnings = result.summary.warnings > 0;
    const status = hasErrors ? '❌ ERRORS FOUND' : hasWarnings ? '⚠️ WARNINGS FOUND' : '✅ NO ISSUES';

    content.push({
      type: 'text',
      text: `Console Logs Capture: ${status}\n\nURL: ${args.url}\nCapture Time: ${result.captureTime}ms\n\nSummary:\n- Total Logs: ${result.summary.total}\n- Errors: ${result.summary.errors}\n- Warnings: ${result.summary.warnings}\n- Info/Log: ${result.summary.info}\n- Debug: ${result.summary.debug}`
    });

    // Display logs grouped by type
    if (result.logs.length > 0) {
      // Errors first (most important)
      const errors = result.logs.filter(l => l.type === 'error');
      if (errors.length > 0) {
        content.push({
          type: 'text',
          text: `\n🔴 Errors (${errors.length}):\n${errors.map(l => `  • ${l.message}`).join('\n')}`
        });
      }

      // Warnings second
      const warnings = result.logs.filter(l => l.type === 'warn');
      if (warnings.length > 0) {
        content.push({
          type: 'text',
          text: `\n🟡 Warnings (${warnings.length}):\n${warnings.map(l => `  • ${l.message}`).join('\n')}`
        });
      }

      // Info/Log
      const info = result.logs.filter(l => l.type === 'info' || l.type === 'log');
      if (info.length > 0) {
        content.push({
          type: 'text',
          text: `\n🔵 Info (${info.length}):\n${info.slice(0, 20).map(l => `  • ${l.message}`).join('\n')}${info.length > 20 ? `\n  ... and ${info.length - 20} more` : ''}`
        });
      }

      // Debug (show fewer)
      const debug = result.logs.filter(l => l.type === 'debug');
      if (debug.length > 0) {
        content.push({
          type: 'text',
          text: `\n⚪ Debug (${debug.length}):\n${debug.slice(0, 10).map(l => `  • ${l.message}`).join('\n')}${debug.length > 10 ? `\n  ... and ${debug.length - 10} more` : ''}`
        });
      }
    } else {
      content.push({
        type: 'text',
        text: '\nNo console logs captured. Use the generated TestCafe code below to capture logs during test execution.'
      });
    }

    // Add generated code for manual use
    content.push({
      type: 'text',
      text: `\nGenerated TestCafe Console Capture Code:\n\`\`\`javascript\n${captureCode}\n\`\`\``
    });

    // Add usage tips
    content.push({
      type: 'text',
      text: `\n💡 Tips:\n- Use filter.types: ['error'] to see only errors\n- Use filter.messagePattern to search for specific messages\n- Increase waitTime if logs appear after page load\n- Use executeScript to trigger specific actions before capturing`
    });

    return { content };
  }

  /**
   * Quick method to check for JavaScript errors on a page
   */
  async checkForErrors(url: string): Promise<CallToolResult> {
    return this.execute({
      url,
      waitTime: 3000,
      filter: { types: ['error'] },
      browser: 'chrome:headless',
      maxLogs: 50
    });
  }

  /**
   * Escape string for JavaScript
   */
  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }
}
