/**
 * Accessibility Snapshot Tool
 *
 * MCP tool for capturing the accessibility tree of a web page.
 * Provides structured, LLM-friendly data about page content (roles, labels, states)
 * without requiring vision capabilities.
 */

import { z } from 'zod';
import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import {
  AccessibilityService,
  AccessibilitySnapshotOptionsSchema,
  AccessibilitySnapshotResult,
  AccessibilityNode
} from '../services/accessibility-service.js';

export type AccessibilitySnapshotInput = z.infer<typeof AccessibilitySnapshotOptionsSchema>;

/**
 * Accessibility Snapshot Tool
 *
 * Returns the accessibility tree of a web page - structured, LLM-friendly data
 * about page content including roles, labels, and states without requiring vision.
 */
export class AccessibilitySnapshotTool implements MCPTool {
  name = 'get_accessibility_snapshot';
  description = 'Return the accessibility tree of a web page - structured, LLM-friendly data about page content including roles, labels, and states without requiring vision. Essential for understanding page structure and interactive elements.';
  inputSchema = AccessibilitySnapshotOptionsSchema;

  private accessibilityService: AccessibilityService;

  constructor() {
    this.accessibilityService = new AccessibilityService();
  }

  async execute(args: AccessibilitySnapshotInput): Promise<CallToolResult> {
    const startTime = Date.now();

    try {
      await this.accessibilityService.initialize();
      const result = await this.accessibilityService.getAccessibilitySnapshot(args);

      return this.formatResult(result, args);

    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Failed to capture accessibility snapshot: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    } finally {
      await this.accessibilityService.close();
    }
  }

  /**
   * Format result for MCP response
   */
  private formatResult(result: AccessibilitySnapshotResult, args: AccessibilitySnapshotInput): CallToolResult {
    const content: CallToolResult['content'] = [];

    // Page info header
    content.push({
      type: 'text',
      text: `Accessibility Snapshot\n\nPage: ${result.pageInfo.title}\nURL: ${result.pageInfo.url}\nLanguage: ${result.pageInfo.language}\nCapture Time: ${result.captureTime}ms`
    });

    // Summary section
    const { summary } = result;
    let summaryText = `\n## Summary\n`;
    summaryText += `- Total Nodes: ${summary.totalNodes}\n`;
    summaryText += `- Interactive Elements: ${summary.interactiveElements}\n`;

    // Role distribution
    if (Object.keys(summary.roleDistribution).length > 0) {
      summaryText += `\n### Roles\n`;
      const sortedRoles = Object.entries(summary.roleDistribution)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15);
      sortedRoles.forEach(([role, count]) => {
        summaryText += `- ${role}: ${count}\n`;
      });
    }

    // Landmarks
    if (summary.landmarks.length > 0) {
      summaryText += `\n### Landmarks\n`;
      summary.landmarks.forEach(landmark => {
        summaryText += `- ${landmark}\n`;
      });
    }

    // Heading structure
    if (summary.headingStructure.length > 0) {
      summaryText += `\n### Heading Structure\n`;
      summary.headingStructure.forEach(heading => {
        const indent = '  '.repeat(heading.level - 1);
        summaryText += `${indent}h${heading.level}: ${heading.text || '(no text)'}\n`;
      });
    }

    // Warnings
    if (summary.warnings.length > 0) {
      summaryText += `\n### Accessibility Warnings\n`;
      summary.warnings.forEach(warning => {
        summaryText += `- ${warning}\n`;
      });
    }

    content.push({
      type: 'text',
      text: summaryText
    });

    // Accessibility tree (simplified text representation)
    if (result.tree) {
      const treeText = this.formatAccessibilityTree(result.tree, 0, 3);
      content.push({
        type: 'text',
        text: `\n## Accessibility Tree (depth 3)\n\n${treeText}`
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
   * Format accessibility tree as text with indentation
   */
  private formatAccessibilityTree(node: AccessibilityNode, depth: number = 0, maxDepth: number = 5): string {
    if (depth > maxDepth) {
      return '';
    }

    const indent = '  '.repeat(depth);
    let output = '';

    // Format node
    const role = node.role || 'unknown';
    const name = node.name ? ` "${node.name}"` : '';
    const states = node.states.length > 0 ? ` [${node.states.join(', ')}]` : '';
    const value = node.value ? ` value="${node.value}"` : '';
    const level = node.level ? ` (level ${node.level})` : '';

    output += `${indent}${role}${name}${value}${states}${level}\n`;

    // Process children
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        output += this.formatAccessibilityTree(child, depth + 1, maxDepth);
      });
    }

    return output;
  }

  /**
   * Quick method to get accessibility snapshot with defaults
   */
  async getSnapshot(url: string): Promise<CallToolResult> {
    return this.execute({
      url,
      maxDepth: 10,
      includeHidden: false,
      browser: 'chrome:headless',
      waitTime: 2000
    });
  }

  /**
   * Get interactive elements only
   */
  async getInteractiveElements(url: string): Promise<CallToolResult> {
    return this.execute({
      url,
      maxDepth: 10,
      includeHidden: false,
      browser: 'chrome:headless',
      waitTime: 2000,
      includeRoles: [
        'button', 'checkbox', 'combobox', 'link', 'listbox',
        'menuitem', 'option', 'radio', 'searchbox', 'slider',
        'spinbutton', 'switch', 'tab', 'textbox', 'treeitem'
      ]
    });
  }

  /**
   * Get landmark elements only
   */
  async getLandmarks(url: string): Promise<CallToolResult> {
    return this.execute({
      url,
      maxDepth: 5,
      includeHidden: false,
      browser: 'chrome:headless',
      waitTime: 2000,
      includeRoles: [
        'banner', 'complementary', 'contentinfo', 'form',
        'main', 'navigation', 'region', 'search'
      ]
    });
  }
}
