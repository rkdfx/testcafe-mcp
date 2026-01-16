/**
 * Tab Management Tool
 *
 * MCP tool for managing browser tabs/windows.
 * Supports listing, creating, closing, and switching between tabs.
 * Note: TestCafe manages "windows" rather than traditional browser tabs.
 */

import { z } from 'zod';
import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import {
  TabManagementService,
  TabManagementOptionsSchema,
  TabInfo
} from '../services/tab-management-service.js';

export type TabManagementInput = z.infer<typeof TabManagementOptionsSchema>;

/**
 * Tab Management Tool
 *
 * Manages browser tabs/windows - list, create, close, and switch between tabs.
 */
export class TabManagementTool implements MCPTool {
  name = 'browser_tabs';
  description = 'Manage browser tabs/windows - list all open tabs, create new tabs, close tabs, and switch between tabs. Note: TestCafe manages windows rather than traditional tabs, but the functionality is similar.';
  inputSchema = TabManagementOptionsSchema;

  private tabService: TabManagementService;

  constructor() {
    this.tabService = new TabManagementService();
  }

  async execute(args: TabManagementInput): Promise<CallToolResult> {
    const startTime = Date.now();

    try {
      await this.tabService.initialize();

      let result: {
        operation: string;
        success: boolean;
        tabs?: TabInfo[];
        activeTab?: TabInfo;
        createdTab?: TabInfo;
        closedTabId?: string;
        error?: string;
        executionTime: number;
      };

      switch (args.operation) {
        case 'list':
          const tabs = await this.tabService.listTabs({ browser: args.browser, initialUrl: args.url });
          result = {
            operation: 'list',
            success: true,
            tabs,
            executionTime: Date.now() - startTime
          };
          break;

        case 'create':
          if (!args.url) {
            throw new McpError(ErrorCode.InvalidParams, 'URL is required for create operation');
          }
          const newTab = await this.tabService.createTab(args.url, {
            browser: args.browser,
            waitForLoad: args.waitForLoad
          });
          result = {
            operation: 'create',
            success: true,
            createdTab: newTab,
            executionTime: Date.now() - startTime
          };
          break;

        case 'close':
          if (!args.tabId) {
            throw new McpError(ErrorCode.InvalidParams, 'tabId is required for close operation');
          }
          const closeSuccess = await this.tabService.closeTab(args.tabId, { browser: args.browser });
          result = {
            operation: 'close',
            success: closeSuccess,
            closedTabId: args.tabId,
            error: closeSuccess ? undefined : 'Failed to close tab. Note: TestCafe requires the window descriptor from openWindow() to close windows.',
            executionTime: Date.now() - startTime
          };
          break;

        case 'switch':
          if (!args.tabId) {
            throw new McpError(ErrorCode.InvalidParams, 'tabId is required for switch operation');
          }
          try {
            const activeTab = await this.tabService.switchTab(args.tabId, { browser: args.browser });
            result = {
              operation: 'switch',
              success: true,
              activeTab,
              executionTime: Date.now() - startTime
            };
          } catch (error) {
            result = {
              operation: 'switch',
              success: false,
              error: error instanceof Error ? error.message : String(error),
              executionTime: Date.now() - startTime
            };
          }
          break;

        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown operation: ${args.operation}`);
      }

      return this.formatResult(result);

    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Tab management operation failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    } finally {
      await this.tabService.close();
    }
  }

  /**
   * Format result for MCP response
   */
  private formatResult(result: {
    operation: string;
    success: boolean;
    tabs?: TabInfo[];
    activeTab?: TabInfo;
    createdTab?: TabInfo;
    closedTabId?: string;
    error?: string;
    executionTime: number;
  }): CallToolResult {
    const content: CallToolResult['content'] = [];

    const status = result.success ? 'SUCCESS' : 'FAILED';
    let headerText = `Tab Management: ${result.operation.toUpperCase()} - ${status}\n`;
    headerText += `Execution Time: ${result.executionTime}ms\n`;

    if (result.error) {
      headerText += `\nError: ${result.error}\n`;
    }

    content.push({
      type: 'text',
      text: headerText
    });

    // Format based on operation
    switch (result.operation) {
      case 'list':
        if (result.tabs && result.tabs.length > 0) {
          let tabsText = '\n## Open Tabs/Windows\n\n';
          result.tabs.forEach((tab, index) => {
            const activeMarker = tab.isActive ? ' (active)' : '';
            tabsText += `${index + 1}. **${tab.title || 'Untitled'}**${activeMarker}\n`;
            tabsText += `   - ID: ${tab.id}\n`;
            tabsText += `   - URL: ${tab.url}\n`;
          });
          content.push({
            type: 'text',
            text: tabsText
          });
        } else {
          content.push({
            type: 'text',
            text: '\nNo tabs/windows found.\n'
          });
        }
        break;

      case 'create':
        if (result.createdTab) {
          let createText = '\n## Created Tab/Window\n\n';
          createText += `- **Title:** ${result.createdTab.title || 'Untitled'}\n`;
          createText += `- **ID:** ${result.createdTab.id}\n`;
          createText += `- **URL:** ${result.createdTab.url}\n`;
          createText += `- **Active:** ${result.createdTab.isActive ? 'Yes' : 'No'}\n`;
          content.push({
            type: 'text',
            text: createText
          });
        }
        break;

      case 'close':
        if (result.success) {
          content.push({
            type: 'text',
            text: `\nTab/window ${result.closedTabId} closed successfully.\n`
          });
        }
        break;

      case 'switch':
        if (result.activeTab) {
          let switchText = '\n## Switched to Tab/Window\n\n';
          switchText += `- **Title:** ${result.activeTab.title || 'Untitled'}\n`;
          switchText += `- **ID:** ${result.activeTab.id}\n`;
          switchText += `- **URL:** ${result.activeTab.url}\n`;
          content.push({
            type: 'text',
            text: switchText
          });
        }
        break;
    }

    // Add usage notes
    content.push({
      type: 'text',
      text: `\n## Notes\n\n- TestCafe manages "windows" rather than traditional browser tabs\n- Window operations require the window descriptor returned by openWindow()\n- Use 'main_window' as tabId to switch back to the parent window\n- The 'list' operation shows currently tracked windows\n`
    });

    // Full result as JSON
    content.push({
      type: 'text',
      text: `\n## Full Result\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
    });

    return { content };
  }

  /**
   * Quick method to list all tabs
   */
  async listAllTabs(): Promise<CallToolResult> {
    return this.execute({
      operation: 'list',
      browser: 'chrome:headless',
      waitForLoad: true,
      timeout: 30000
    });
  }

  /**
   * Quick method to create a new tab
   */
  async createNewTab(url: string): Promise<CallToolResult> {
    return this.execute({
      operation: 'create',
      url,
      browser: 'chrome:headless',
      waitForLoad: true,
      timeout: 30000
    });
  }

  /**
   * Quick method to switch to main window
   */
  async switchToMainWindow(): Promise<CallToolResult> {
    return this.execute({
      operation: 'switch',
      tabId: 'main_window',
      browser: 'chrome:headless',
      waitForLoad: true,
      timeout: 30000
    });
  }
}
