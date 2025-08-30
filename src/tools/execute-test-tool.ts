/**
 * Execute Test Tool
 * 
 * MCP tool for executing TestCafe tests with configurable options.
 */

import { z } from 'zod';
import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import { TestCafeService, TestExecutionResult } from '../services/index.js';
import { existsSync } from 'fs';

/**
 * Input schema for ExecuteTestTool
 */
export const ExecuteTestInputSchema = z.object({
  testPath: z.string().min(1, 'Test path or code is required').optional(),
  testCode: z.string().min(1, 'Test code is required').optional(),
  browsers: z.array(z.string()).optional(),
  reporter: z.enum(['spec', 'json', 'minimal', 'xunit', 'list']).optional().default('spec'),
  screenshots: z.boolean().optional().default(false),
  screenshotPath: z.string().optional(),
  video: z.boolean().optional().default(false),
  videoPath: z.string().optional(),
  concurrency: z.number().min(1).max(10).optional(),
  speed: z.number().min(0.01).max(1).optional(),
  timeout: z.number().min(1000).max(300000).optional(),
  quarantine: z.boolean().optional().default(false),
  skipJsErrors: z.boolean().optional(),
  stopOnFirstFail: z.boolean().optional().default(false),
  filter: z.object({
    test: z.string().optional(),
    fixture: z.string().optional(),
    testGrep: z.string().optional(),
    fixtureGrep: z.string().optional()
  }).optional()
}).refine(data => data.testPath || data.testCode, {
  message: 'Either testPath or testCode must be provided'
});

export type ExecuteTestInput = z.infer<typeof ExecuteTestInputSchema>;

/**
 * Execute Test Tool
 * 
 * Executes TestCafe tests with comprehensive configuration options.
 */
export class ExecuteTestTool implements MCPTool {
  name = 'execute_test';
  description = 'Execute TestCafe tests with configurable browsers and options';
  inputSchema = ExecuteTestInputSchema;

  private testCafeService: TestCafeService;

  constructor(testCafeService: TestCafeService) {
    this.testCafeService = testCafeService;
  }

  async execute(args: ExecuteTestInput): Promise<CallToolResult> {
    try {
      // Prepare execution options
      const executionOptions = {
        browsers: args.browsers,
        reporter: args.reporter,
        screenshots: args.screenshots,
        screenshotPath: args.screenshotPath,
        video: args.video,
        videoPath: args.videoPath,
        concurrency: args.concurrency,
        speed: args.speed,
        timeout: args.timeout,
        quarantine: args.quarantine,
        stopOnFirstFail: args.stopOnFirstFail,
        filter: args.filter
      };

      const startTime = Date.now();
      let result: TestExecutionResult;

      if (args.testCode) {
        // Execute test code directly
        result = await this.testCafeService.executeTestCode(args.testCode, executionOptions);
      } else if (args.testPath) {
        // Validate test file exists
        if (!existsSync(args.testPath)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Test file not found: ${args.testPath}`,
            { testPath: args.testPath }
          );
        }

        // Execute test file
        result = await this.testCafeService.executeTest(args.testPath, executionOptions);
      } else {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Either testPath or testCode must be provided'
        );
      }

      const executionTime = Date.now() - startTime;

      // Format results
      return this.formatExecutionResult(result, args, executionTime);

    } catch (error) {
      // Re-throw MCP errors
      if (error instanceof McpError) {
        throw error;
      }

      // Handle TestCafe execution errors
      throw new McpError(
        ErrorCode.InternalError,
        `Test execution failed: ${error instanceof Error ? error.message : String(error)}`,
        { 
          testPath: args.testPath,
          testCode: args.testCode ? 'provided' : undefined,
          originalError: error 
        }
      );
    }
  }

  /**
   * Execute tests with minimal configuration
   */
  async executeSimple(testPath: string, browser?: string): Promise<CallToolResult> {
    const args: ExecuteTestInput = {
      testPath,
      browsers: browser ? [browser] : undefined,
      reporter: 'spec',
      screenshots: false,
      video: false,
      quarantine: false,
      stopOnFirstFail: false
    };

    return this.execute(args);
  }

  /**
   * Execute tests in headless mode for CI/CD
   */
  async executeCi(testPath: string, options?: {
    browsers?: string[];
    reporter?: 'json' | 'xunit';
    outputPath?: string;
  }): Promise<CallToolResult> {
    const args: ExecuteTestInput = {
      testPath,
      browsers: options?.browsers || ['chrome:headless'],
      reporter: options?.reporter || 'json',
      screenshots: true,
      screenshotPath: './screenshots',
      video: false,
      quarantine: false,
      stopOnFirstFail: false,
      skipJsErrors: true
    };

    return this.execute(args);
  }

  /**
   * Execute tests with debugging options
   */
  async executeDebug(testPath: string, options?: {
    browser?: string;
    speed?: number;
    screenshots?: boolean;
  }): Promise<CallToolResult> {
    const args: ExecuteTestInput = {
      testPath,
      browsers: [options?.browser || 'chrome'],
      reporter: 'spec',
      speed: options?.speed || 0.5,
      screenshots: options?.screenshots ?? true,
      screenshotPath: './debug-screenshots',
      video: false,
      quarantine: false,
      stopOnFirstFail: true
    };

    return this.execute(args);
  }

  /**
   * Get execution summary
   */
  getExecutionSummary(result: TestExecutionResult): string {
    const total = result.passedCount + result.failedCount + result.skippedCount;
    const successRate = total > 0 ? Math.round((result.passedCount / total) * 100) : 0;
    
    let summary = `Test Execution Summary:\n`;
    summary += `- Total Tests: ${total}\n`;
    summary += `- Passed: ${result.passedCount}\n`;
    summary += `- Failed: ${result.failedCount}\n`;
    summary += `- Skipped: ${result.skippedCount}\n`;
    summary += `- Success Rate: ${successRate}%\n`;
    summary += `- Duration: ${this.formatDuration(result.duration)}\n`;
    summary += `- Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`;

    return summary;
  }

  /**
   * Format execution result for MCP response
   */
  private formatExecutionResult(
    result: TestExecutionResult, 
    args: ExecuteTestInput, 
    executionTime: number
  ): CallToolResult {
    const content: CallToolResult['content'] = [];

    // Add execution summary
    content.push({
      type: 'text',
      text: this.getExecutionSummary(result)
    });

    // Add configuration details
    let configText = `Configuration:\n- Source: ${args.testPath || 'inline code'}\n- Browsers: ${args.browsers?.join(', ') || 'default'}\n- Reporter: ${args.reporter}\n- Screenshots: ${args.screenshots ? 'enabled' : 'disabled'}`;
    
    if (args.video) {
      configText += `\n- Video Recording: enabled`;
      if (args.videoPath) {
        configText += ` (${args.videoPath})`;
      }
    }
    
    if (args.concurrency && args.concurrency > 1) {
      configText += `\n- Concurrency: ${args.concurrency}`;
    }
    
    if (args.speed && args.speed !== 1) {
      configText += `\n- Speed: ${args.speed}x`;
    }
    
    content.push({
      type: 'text',
      text: configText
    });

    // Add errors if any
    if (result.errors.length > 0) {
      const errorText = result.errors.map(error => 
        `❌ ${error.testName}: ${error.error}${error.stack ? '\n   Stack: ' + error.stack : ''}`
      ).join('\n\n');
      
      content.push({
        type: 'text',
        text: `Errors:\n${errorText}`
      });
    }

    // Add warnings if any
    if (result.warnings.length > 0) {
      content.push({
        type: 'text',
        text: `Warnings:\n${result.warnings.map(w => `⚠️  ${w}`).join('\n')}`
      });
    }

    // Add artifacts information
    if (result.screenshots && result.screenshots.length > 0) {
      content.push({
        type: 'text',
        text: `Screenshots (${result.screenshots.length}):\n${result.screenshots.map(path => `- ${path}`).join('\n')}`
      });
    }

    if (result.videos && result.videos.length > 0) {
      content.push({
        type: 'text',
        text: `Videos (${result.videos.length}):\n${result.videos.map(path => `- ${path}`).join('\n')}`
      });
    }

    // Add performance metrics
    content.push({
      type: 'text',
      text: `Performance:\n- Test Execution: ${this.formatDuration(result.duration)}\n- Total Time: ${this.formatDuration(executionTime)}\n- Average per Test: ${this.formatDuration(result.duration / Math.max(1, result.passedCount + result.failedCount))}`
    });

    return { content };
  }

  /**
   * Format duration in milliseconds to human readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Validate test execution parameters
   */
  validateExecutionParams(args: unknown): { isValid: boolean; errors: string[] } {
    try {
      ExecuteTestInputSchema.parse(args);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        return { isValid: false, errors };
      }
      return { 
        isValid: false, 
        errors: [error instanceof Error ? error.message : String(error)] 
      };
    }
  }
}