/**
 * Browser Click Tool
 *
 * MCP tool for clicking an element identified by its snapshot ref.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import { BrowserSessionManager } from '../services/browser-session-manager.js';

const InputSchema = z.object({
  ref: z.string().describe('Exact target element reference from the page snapshot'),
  element: z
    .string()
    .optional()
    .describe('Human-readable element description used to obtain permission to interact with the element'),
  button: z
    .enum(['left', 'right', 'middle'])
    .optional()
    .describe('Button to click, defaults to left'),
  doubleClick: z
    .boolean()
    .optional()
    .describe('Whether to perform a double click instead of a single click'),
});

export class BrowserClickTool implements MCPTool {
  name = 'browser_click';
  description = 'Perform click on a web page';
  inputSchema = InputSchema;

  constructor(private sessionManager: BrowserSessionManager) {}

  async execute(args: z.infer<typeof InputSchema>): Promise<CallToolResult> {
    await this.sessionManager.click(args.ref, {
      button: args.button,
      doubleClick: args.doubleClick,
    });
    return {
      content: [
        {
          type: 'text',
          text: `Clicked ${args.element ?? args.ref}`,
        },
      ],
    };
  }
}
