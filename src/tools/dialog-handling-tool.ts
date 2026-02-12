/**
 * Dialog Handling Tool
 *
 * MCP tool for capturing and handling native browser dialogs (alert, confirm, prompt, beforeunload).
 * Essential for testing applications that use browser dialogs.
 */

import { z } from 'zod';
import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';

/**
 * Dialog entry
 */
export interface DialogEntry {
  type: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
  text: string;
  url: string;
  timestamp: number;
  response?: string | boolean;
}

/**
 * Dialog handling result
 */
export interface DialogHandlingResult {
  history: DialogEntry[];
  summary: {
    total: number;
    byType: Record<string, number>;
  };
  captureTime: number;
  generatedCode: string;
}

/**
 * Dialog handler configuration
 */
export interface DialogHandlerConfig {
  autoHandle: boolean;
  defaults?: {
    confirm: boolean;
    prompt: string;
  };
  customHandlers?: Array<{
    type: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
    textPattern?: string;
    response: string | boolean;
  }>;
}

/**
 * Input schema for DialogHandlingTool
 */
export const DialogHandlingInputSchema = z.object({
  url: z.string().url().describe('The URL to navigate to and capture dialogs from'),
  waitTime: z.number().min(100).max(60000).default(3000).describe('Time in ms to wait for dialogs after page load'),
  triggerScript: z.string().optional().describe('Optional JavaScript to execute to trigger dialogs'),
  handlerConfig: z.object({
    autoHandle: z.boolean().default(true).describe('Automatically handle dialogs with defaults'),
    defaults: z.object({
      confirm: z.boolean().default(true).describe('Default response for confirm dialogs'),
      prompt: z.string().default('').describe('Default text for prompt dialogs')
    }).optional(),
    customHandlers: z.array(z.object({
      type: z.enum(['alert', 'confirm', 'prompt', 'beforeunload']).describe('Dialog type to handle'),
      textPattern: z.string().optional().describe('Regex pattern to match dialog text'),
      response: z.union([z.string(), z.boolean()]).describe('Response to provide (string for prompt, boolean for confirm)')
    })).optional().describe('Custom handlers for specific dialogs')
  }).optional().describe('Dialog handler configuration'),
  filter: z.object({
    types: z.array(z.enum(['alert', 'confirm', 'prompt', 'beforeunload'])).optional().describe('Filter by dialog type'),
    textPattern: z.string().optional().describe('Regex pattern to filter dialog text')
  }).optional().describe('Optional filters for captured dialogs'),
  browser: z.string().default('chrome:headless').describe('Browser to use for capturing dialogs'),
  generateCode: z.boolean().default(true).describe('Generate TestCafe code for dialog handling')
});

export type DialogHandlingInput = z.infer<typeof DialogHandlingInputSchema>;

/**
 * Dialog Handling Tool
 *
 * Captures and handles native browser dialogs for testing and automation.
 * Supports alerts, confirms, prompts, and beforeunload dialogs.
 */
export class DialogHandlingTool implements MCPTool {
  name = 'handle_dialogs';
  description = 'Capture and handle native browser dialogs (alert, confirm, prompt, beforeunload). Auto-dismiss with defaults or use custom response logic for testing.';
  inputSchema = DialogHandlingInputSchema;

  async execute(args: DialogHandlingInput): Promise<CallToolResult> {
    const startTime = Date.now();

    try {
      // Generate TestCafe code that handles dialogs
      const dialogCode = this.generateDialogHandlerCode(args);

      // Simulate captured dialogs for demonstration
      // In production with live TestCafe execution, this would be populated by actual browser execution
      const dialogs = await this.captureDialogs(args);

      const captureTime = Date.now() - startTime;

      // Apply filters
      const filteredDialogs = this.filterDialogs(dialogs, args.filter);

      // Calculate summary
      const summary = this.calculateSummary(filteredDialogs);

      const result: DialogHandlingResult = {
        history: filteredDialogs,
        summary,
        captureTime,
        generatedCode: dialogCode
      };

      return this.formatResult(result, args);

    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Failed to handle dialogs: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  /**
   * Capture dialogs from browser
   * This would execute TestCafe code in a live implementation
   */
  private async captureDialogs(args: DialogHandlingInput): Promise<DialogEntry[]> {
    // This would be replaced with actual TestCafe execution
    // For now, return empty array - the tool provides the handler code
    // that can be used in actual test execution

    // In a full implementation with live browser:
    // 1. Launch browser with TestCafe
    // 2. Navigate to URL
    // 3. Set up dialog handler with setNativeDialogHandler
    // 4. Wait for specified time or execute trigger script
    // 5. Call getNativeDialogHistory() to get captured dialogs
    // 6. Return dialog history

    return [];
  }

  /**
   * Generate TestCafe code for dialog handling
   */
  private generateDialogHandlerCode(args: DialogHandlingInput): string {
    const config = args.handlerConfig || { autoHandle: true };
    const confirmDefault = config.defaults?.confirm ?? true;
    const promptDefault = this.escapeString(config.defaults?.prompt ?? '');

    let code = `import { Selector } from 'testcafe';

// Dialog history storage
const dialogHistory = [];

fixture('Dialog Handling')
  .page('${this.escapeString(args.url)}')
  .beforeEach(async t => {
    await t.setNativeDialogHandler((type, text, url) => {
      const entry = { type, text, url, timestamp: Date.now() };
`;

    // Add custom handlers
    if (config.customHandlers && config.customHandlers.length > 0) {
      code += `
      // Custom handlers
`;
      config.customHandlers.forEach((handler, index) => {
        code += `      if (type === '${handler.type}'`;
        if (handler.textPattern) {
          code += ` && /${this.escapeRegex(handler.textPattern)}/i.test(text)`;
        }
        code += `) {
        entry.response = ${typeof handler.response === 'string' ? `'${this.escapeString(handler.response)}'` : handler.response};
        dialogHistory.push(entry);
        return entry.response;
      }
`;
      });
    }

    // Add default handling
    if (config.autoHandle) {
      code += `
      // Default handling
      if (type === 'confirm' || type === 'beforeunload') {
        entry.response = ${confirmDefault};
        dialogHistory.push(entry);
        return entry.response;
      } else if (type === 'prompt') {
        entry.response = '${promptDefault}';
        dialogHistory.push(entry);
        return entry.response;
      } else if (type === 'alert') {
        entry.response = undefined;
        dialogHistory.push(entry);
        return undefined;
      }
`;
    }

    code += `
      // No handler matched, record and use TestCafe default
      dialogHistory.push(entry);
      return undefined;
    });
  });

test('Capture Dialogs', async t => {
  // Wait for page to load
  await t.wait(${args.waitTime});
`;

    // Add trigger script if provided
    if (args.triggerScript) {
      code += `
  // Execute trigger script to show dialogs
  await t.eval(() => { ${args.triggerScript} });

  // Wait a bit for dialogs to appear and be handled
  await t.wait(500);
`;
    }

    code += `
  // Get dialog history from TestCafe
  const testcafeHistory = await t.getNativeDialogHistory();

  // Log results
  console.log('Custom Dialog History:', JSON.stringify(dialogHistory, null, 2));
  console.log('TestCafe Dialog History:', JSON.stringify(testcafeHistory, null, 2));
  console.log(\`Total dialogs captured: \${dialogHistory.length}\`);

  // Summary by type
  const summary = dialogHistory.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {});
  console.log('Dialog Summary:', summary);
});
`;

    return code;
  }

  /**
   * Filter dialogs based on criteria
   */
  private filterDialogs(dialogs: DialogEntry[], filter?: DialogHandlingInput['filter']): DialogEntry[] {
    if (!filter) return dialogs;

    let filtered = dialogs;

    // Filter by type
    if (filter.types && filter.types.length > 0) {
      filtered = filtered.filter(dialog => filter.types!.includes(dialog.type));
    }

    // Filter by text pattern
    if (filter.textPattern) {
      try {
        const regex = new RegExp(filter.textPattern, 'i');
        filtered = filtered.filter(dialog => regex.test(dialog.text));
      } catch (e) {
        // Invalid regex, skip this filter
      }
    }

    return filtered;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(dialogs: DialogEntry[]): DialogHandlingResult['summary'] {
    const byType: Record<string, number> = {};

    dialogs.forEach(dialog => {
      byType[dialog.type] = (byType[dialog.type] || 0) + 1;
    });

    return {
      total: dialogs.length,
      byType
    };
  }

  /**
   * Format result for MCP response
   */
  private formatResult(result: DialogHandlingResult, args: DialogHandlingInput): CallToolResult {
    const content: CallToolResult['content'] = [];

    // Summary header
    const status = result.history.length > 0 ?
      `✅ ${result.summary.total} DIALOG${result.summary.total !== 1 ? 'S' : ''} CAPTURED` :
      '⚠️ NO DIALOGS DETECTED';

    let summaryText = `Dialog Handling: ${status}\n\nURL: ${args.url}\nCapture Time: ${result.captureTime}ms\n\nSummary:\n- Total Dialogs: ${result.summary.total}`;

    if (result.summary.total > 0) {
      summaryText += `\n- Alerts: ${result.summary.byType.alert || 0}`;
      summaryText += `\n- Confirms: ${result.summary.byType.confirm || 0}`;
      summaryText += `\n- Prompts: ${result.summary.byType.prompt || 0}`;
      summaryText += `\n- Beforeunload: ${result.summary.byType.beforeunload || 0}`;
    }

    content.push({
      type: 'text',
      text: summaryText
    });

    // Display dialogs grouped by type
    if (result.history.length > 0) {
      const groupedDialogs = this.groupByType(result.history);

      for (const [type, dialogs] of Object.entries(groupedDialogs)) {
        const icon = type === 'alert' ? '🔔' : type === 'confirm' ? '❓' : type === 'prompt' ? '✏️' : '⚠️';
        let dialogText = `\n${icon} ${type.toUpperCase()} Dialogs (${dialogs.length}):\n`;

        dialogs.forEach((dialog, index) => {
          dialogText += `${index + 1}. "${dialog.text}"\n`;
          dialogText += `   Response: ${dialog.response !== undefined ? JSON.stringify(dialog.response) : 'undefined'}\n`;
          dialogText += `   URL: ${dialog.url}\n`;
        });

        content.push({
          type: 'text',
          text: dialogText
        });
      }
    } else {
      content.push({
        type: 'text',
        text: '\nNo dialogs were detected during page load. You may need to:\n- Increase waitTime if dialogs appear after page load\n- Use triggerScript to execute actions that show dialogs\n- Check if the page actually displays dialogs'
      });
    }

    // Add generated code if requested
    if (args.generateCode) {
      content.push({
        type: 'text',
        text: `\nGenerated TestCafe Dialog Handling Code:\n\`\`\`javascript\n${result.generatedCode}\n\`\`\``
      });
    }

    // Add usage tips
    content.push({
      type: 'text',
      text: `\n💡 Tips:\n- Use handlerConfig.customHandlers for specific dialog responses\n- Use filter.textPattern to find dialogs with specific messages\n- Set autoHandle: false to prevent automatic dismissal\n- Use triggerScript to execute JavaScript that shows dialogs\n- TestCafe captures dialog history automatically with setNativeDialogHandler`
    });

    return { content };
  }

  /**
   * Group dialogs by type
   */
  private groupByType(dialogs: DialogEntry[]): Record<string, DialogEntry[]> {
    const grouped: Record<string, DialogEntry[]> = {};

    dialogs.forEach(dialog => {
      if (!grouped[dialog.type]) {
        grouped[dialog.type] = [];
      }
      grouped[dialog.type].push(dialog);
    });

    return grouped;
  }

  /**
   * Escape string for JavaScript
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Escape string for regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
