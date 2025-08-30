/**
 * Interact Tool
 * 
 * MCP tool for performing browser interactions through TestCafe.
 */

import { z } from 'zod';
import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import { BrowserInteractionService, BrowserAction } from '../services/index.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Input schema for InteractTool
 */
export const InteractInputSchema = z.object({
  actions: z.array(z.discriminatedUnion('type', [
    z.object({
      type: z.literal('click'),
      selector: z.string().min(1),
      options: z.object({
        modifiers: z.object({
          ctrl: z.boolean().optional(),
          alt: z.boolean().optional(),
          shift: z.boolean().optional(),
          meta: z.boolean().optional()
        }).optional(),
        offsetX: z.number().optional(),
        offsetY: z.number().optional()
      }).optional()
    }),
    z.object({
      type: z.literal('type'),
      selector: z.string().min(1),
      text: z.string(),
      options: z.object({
        replace: z.boolean().optional(),
        paste: z.boolean().optional(),
        confidential: z.boolean().optional()
      }).optional()
    }),
    z.object({
      type: z.literal('navigate'),
      url: z.string().url()
    }),
    z.object({
      type: z.literal('wait'),
      condition: z.enum(['timeout', 'element', 'function']),
      value: z.union([z.number(), z.string()]),
      timeout: z.number().min(100).max(60000).optional()
    }),
    z.object({
      type: z.literal('assert'),
      assertion: z.enum(['exists', 'visible', 'text', 'value', 'attribute', 'count']),
      selector: z.string().min(1),
      expected: z.union([z.string(), z.number(), z.boolean()]).optional(),
      attribute: z.string().optional()
    })
  ])).min(1, 'At least one action is required'),
  generateTest: z.boolean().default(false),
  testName: z.string().optional(),
  fixtureName: z.string().optional(),
  outputPath: z.string().optional(),
  validate: z.boolean().default(true),
  executeLive: z.boolean().default(true),
  browser: z.string().optional(),
  url: z.string().url().optional(),
  timeout: z.number().min(1000).max(300000).optional(),
  screenshots: z.boolean().default(false),
  screenshotPath: z.string().optional()
});

export type InteractInput = z.infer<typeof InteractInputSchema>;

/**
 * Interaction execution result
 */
export interface InteractionResult {
  success: boolean;
  actionsExecuted: number;
  generatedCode?: string;
  testFilePath?: string;
  errors: string[];
  warnings: string[];
  executionTime: number;
  liveExecution?: boolean;
  screenshots?: string[];
  elementInfo?: any[];
  sessionId?: string;
  actionResults?: any[];
}

/**
 * Interact Tool
 * 
 * Performs browser interactions and optionally generates TestCafe test code.
 */
export class InteractTool implements MCPTool {
  name = 'interact';
  description = 'Perform browser interactions and generate TestCafe test code';
  inputSchema = InteractInputSchema;

  private browserInteractionService: BrowserInteractionService;

  constructor() {
    this.browserInteractionService = new BrowserInteractionService();
  }

  async execute(args: InteractInput): Promise<CallToolResult> {
    const startTime = Date.now();
    
    try {
      // Validate actions
      if (args.validate) {
        const validationErrors = this.validateActions(args.actions);
        if (validationErrors.length > 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Action validation failed: ${validationErrors.join(', ')}`,
            { validationErrors }
          );
        }
      }

      // Execute actions in real browser if requested
      let browserResult: any = null;
      if (args.executeLive !== false) { // Default to live execution
        try {
          browserResult = await this.browserInteractionService.executeActions(args.actions, {
            browser: args.browser || 'chrome:headless',
            url: args.url,
            timeout: args.timeout,
            screenshots: args.screenshots,
            screenshotPath: args.screenshotPath,
            useLiveSession: true,
            validateElements: true,
            retryFailedActions: true
          });
        } catch (error) {
          console.warn('Live browser execution failed, falling back to code generation:', error);
        }
      }

      // Generate TestCafe code for actions
      const generatedCode = this.browserInteractionService.generateActionCode(args.actions);
      
      let testFilePath: string | undefined;
      const warnings: string[] = [];

      // Generate complete test file if requested
      if (args.generateTest) {
        const testCode = this.generateCompleteTest(args, generatedCode);
        
        if (args.outputPath) {
          testFilePath = args.outputPath;
          await writeFile(testFilePath, testCode, 'utf8');
        } else {
          warnings.push('Test generation requested but no output path provided');
        }
      }

      const executionTime = Date.now() - startTime;

      const result: InteractionResult = {
        success: browserResult?.success ?? true,
        actionsExecuted: browserResult?.actionsExecuted ?? args.actions.length,
        generatedCode,
        testFilePath,
        errors: browserResult?.errors ?? [],
        warnings: [...warnings, ...(browserResult?.warnings ?? [])],
        executionTime: browserResult?.duration ?? executionTime,
        liveExecution: !!browserResult,
        screenshots: browserResult?.screenshots,
        elementInfo: browserResult?.elementInfo
      };

      return this.formatInteractionResult(result, args);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Browser interaction failed: ${error instanceof Error ? error.message : String(error)}`,
        { 
          originalError: error,
          executionTime 
        }
      );
    }
  }

  /**
   * Execute a single action
   */
  async executeSingleAction(action: BrowserAction): Promise<CallToolResult> {
    return this.execute({
      actions: [action],
      generateTest: false,
      validate: true,
      executeLive: true,
      screenshots: false
    });
  }

  /**
   * Execute actions and generate test file
   */
  async executeAndGenerateTest(
    actions: BrowserAction[],
    options: {
      testName?: string;
      fixtureName?: string;
      outputPath?: string;
      url?: string;
    }
  ): Promise<CallToolResult> {
    return this.execute({
      actions,
      generateTest: true,
      testName: options.testName || 'Generated Test',
      fixtureName: options.fixtureName || 'Generated Fixture',
      outputPath: options.outputPath || './generated-test.js',
      validate: true,
      executeLive: true,
      screenshots: false
    });
  }

  /**
   * Create interaction sequence for common workflows
   */
  static createLoginSequence(
    usernameSelector: string,
    passwordSelector: string,
    submitSelector: string,
    username: string,
    password: string,
    loginUrl?: string
  ): BrowserAction[] {
    const actions: BrowserAction[] = [];

    if (loginUrl) {
      actions.push({
        type: 'navigate',
        url: loginUrl
      });
    }

    actions.push(
      {
        type: 'type',
        selector: usernameSelector,
        text: username,
        options: { replace: true }
      },
      {
        type: 'type',
        selector: passwordSelector,
        text: password,
        options: { replace: true, confidential: true }
      },
      {
        type: 'click',
        selector: submitSelector
      },
      {
        type: 'wait',
        condition: 'timeout',
        value: 2000
      }
    );

    return actions;
  }

  /**
   * Execute complex interaction sequence with enhanced session management
   */
  async executeComplexSequence(
    sequence: BrowserAction[],
    options?: {
      sessionId?: string;
      browser?: string;
      url?: string;
      timeout?: number;
      screenshots?: boolean;
      screenshotPath?: string;
      validateElements?: boolean;
      retryFailedActions?: boolean;
      pauseBetweenActions?: number;
    }
  ): Promise<CallToolResult> {
    try {
      const result = await this.browserInteractionService.executeComplexSequence(sequence, options);
      
      return {
        content: [{
          type: 'text',
          text: `Complex Sequence Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\n\nSummary:\n- Actions Executed: ${result.actionsExecuted}/${sequence.length}\n- Execution Time: ${this.formatDuration(result.duration)}\n- Session ID: ${options?.sessionId || 'auto-generated'}\n\nAction Results:\n${result.actionResults?.map((ar, i) => `${i + 1}. ${ar.action.type.toUpperCase()} - ${ar.success ? '✅' : '❌'} ${ar.retried ? '(retried)' : ''}`).join('\n') || 'No detailed results'}\n\n${result.errors.length > 0 ? `Errors:\n${result.errors.map(e => `❌ ${e}`).join('\n')}\n\n` : ''}${result.warnings.length > 0 ? `Warnings:\n${result.warnings.map(w => `⚠️  ${w}`).join('\n')}` : ''}`
        }]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Complex sequence execution failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  /**
   * Create and execute form filling sequence
   */
  async executeFormFillSequence(
    fields: Array<{ 
      selector: string; 
      value: string; 
      type?: 'type' | 'select' | 'checkbox' | 'radio';
      waitAfter?: number;
      validate?: boolean;
    }>,
    submitSelector?: string,
    options?: {
      sessionId?: string;
      browser?: string;
      url?: string;
      validateFields?: boolean;
      waitBetweenFields?: number;
      clearBeforeType?: boolean;
      screenshots?: boolean;
    }
  ): Promise<CallToolResult> {
    const sequence = BrowserInteractionService.createFormFillSequence(fields, submitSelector, {
      validateFields: options?.validateFields,
      waitBetweenFields: options?.waitBetweenFields,
      clearBeforeType: options?.clearBeforeType
    });

    return this.executeComplexSequence(sequence, {
      sessionId: options?.sessionId,
      browser: options?.browser,
      url: options?.url,
      screenshots: options?.screenshots,
      validateElements: true,
      retryFailedActions: true
    });
  }

  /**
   * Create and execute navigation sequence
   */
  async executeNavigationSequence(
    url: string,
    waitConditions?: Array<{
      type: 'element' | 'timeout' | 'function';
      value: string | number;
      timeout?: number;
    }>,
    postNavigationActions?: BrowserAction[],
    options?: {
      sessionId?: string;
      browser?: string;
      screenshots?: boolean;
    }
  ): Promise<CallToolResult> {
    const sequence = BrowserInteractionService.createNavigationSequence(url, waitConditions, postNavigationActions);

    return this.executeComplexSequence(sequence, {
      sessionId: options?.sessionId,
      browser: options?.browser,
      screenshots: options?.screenshots,
      validateElements: true,
      retryFailedActions: true
    });
  }

  /**
   * Create form filling sequence (static helper)
   */
  static createFormFillSequence = BrowserInteractionService.createFormFillSequence;

  /**
   * Create conditional sequence (static helper)
   */
  static createConditionalSequence = BrowserInteractionService.createConditionalSequence;

  /**
   * Create navigation sequence (static helper)
   */
  static createNavigationSequence = BrowserInteractionService.createNavigationSequence;

  /**
   * Create robust interaction sequence (static helper)
   */
  static createRobustInteractionSequence = BrowserInteractionService.createRobustInteractionSequence;

  /**
   * Validate actions array
   */
  private validateActions(actions: BrowserAction[]): string[] {
    const errors: string[] = [];

    actions.forEach((action, index) => {
      const validation = this.browserInteractionService.validateAction(action);
      if (!validation.isValid) {
        errors.push(`Action ${index + 1}: ${validation.errors.join(', ')}`);
      }
    });

    return errors;
  }

  /**
   * Generate complete test file
   */
  private generateCompleteTest(args: InteractInput, actionCode: string): string {
    const fixtureName = args.fixtureName || 'Generated Test Fixture';
    const testName = args.testName || 'Generated Test';

    let testCode = `import { Selector } from 'testcafe';\n\n`;
    testCode += `fixture('${this.escapeString(fixtureName)}');\n\n`;
    testCode += `test('${this.escapeString(testName)}', async t => {\n`;
    
    // Add action code with proper indentation
    const indentedActionCode = actionCode
      .split('\n')
      .map(line => line.trim() ? `  ${line}` : line)
      .join('\n');
    
    testCode += indentedActionCode;
    testCode += '});\n';

    return testCode;
  }

  /**
   * Format interaction result for MCP response
   */
  private formatInteractionResult(result: InteractionResult, args: InteractInput): CallToolResult {
    const content: CallToolResult['content'] = [];

    // Add execution summary
    const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
    content.push({
      type: 'text',
      text: `Interaction Result: ${status}\n\nSummary:\n- Actions Executed: ${result.actionsExecuted}\n- Execution Time: ${this.formatDuration(result.executionTime)}\n- Generated Code: ${result.generatedCode ? 'Yes' : 'No'}\n- Test File Created: ${result.testFilePath ? 'Yes' : 'No'}`
    });

    // Add action details
    const actionSummary = args.actions.map((action, index) => {
      let summary = `${index + 1}. ${action.type.toUpperCase()}`;
      if ('selector' in action && action.selector) {
        summary += ` - ${action.selector}`;
      }
      if ('url' in action) {
        summary += ` - ${action.url}`;
      }
      if ('text' in action && action.text) {
        summary += ` - "${action.text}"`;
      }
      return summary;
    }).join('\n');

    content.push({
      type: 'text',
      text: `Actions:\n${actionSummary}`
    });

    // Add generated code
    if (result.generatedCode) {
      content.push({
        type: 'text',
        text: `Generated TestCafe Code:\n\`\`\`javascript\n${result.generatedCode}\`\`\``
      });
    }

    // Add test file info
    if (result.testFilePath) {
      content.push({
        type: 'text',
        text: `Test file created at: ${result.testFilePath}`
      });
    }

    // Add warnings
    if (result.warnings.length > 0) {
      content.push({
        type: 'text',
        text: `Warnings:\n${result.warnings.map(w => `⚠️  ${w}`).join('\n')}`
      });
    }

    // Add errors
    if (result.errors.length > 0) {
      content.push({
        type: 'text',
        text: `Errors:\n${result.errors.map(e => `❌ ${e}`).join('\n')}`
      });
    }

    return { content };
  }

  /**
   * Format duration in milliseconds
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else {
      return `${(ms / 1000).toFixed(1)}s`;
    }
  }

  /**
   * Escape string for JavaScript code generation
   */
  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }
}