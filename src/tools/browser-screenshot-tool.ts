/**
 * Browser Screenshot Tool
 *
 * MCP tool for taking a screenshot of the current page.
 */

import { z } from 'zod';
import { readFile } from 'fs/promises';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import { BrowserSessionManager } from '../services/browser-session-manager.js';

const InputSchema = z.object({
  filename: z
    .string()
    .optional()
    .describe(
      'File name to save the screenshot to. Defaults to screenshot-{timestamp}.png if not specified.',
    ),
  fullPage: z
    .boolean()
    .optional()
    .describe(
      'When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport.',
    ),
  type: z
    .enum(['png', 'jpeg'])
    .optional()
    .default('png')
    .describe('Image format for the screenshot. Default is png.'),
});

export class BrowserScreenshotTool implements MCPTool {
  name = 'browser_take_screenshot';
  description =
    'Take a screenshot of the current page. You can\'t perform actions based on the screenshot, use browser_snapshot for actions.';
  inputSchema = InputSchema;

  constructor(private sessionManager: BrowserSessionManager) {}

  async execute(args: z.infer<typeof InputSchema>): Promise<CallToolResult> {
    const filepath = await this.sessionManager.screenshot({
      filename: args.filename,
      fullPage: args.fullPage,
    });

    // Try to include the image as base64
    try {
      const imageBuffer = await readFile(filepath);
      const base64 = imageBuffer.toString('base64');
      const mimeType = args.type === 'jpeg' ? 'image/jpeg' : 'image/png';
      return {
        content: [
          {
            type: 'text',
            text: `Screenshot saved to ${filepath}`,
          },
          {
            type: 'image',
            data: base64,
            mimeType,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: 'text',
            text: `Screenshot saved to ${filepath}`,
          },
        ],
      };
    }
  }
}
