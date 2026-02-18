/**
 * Browser Navigate Tool
 *
 * MCP tool for navigating to a URL in the persistent browser session.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import { BrowserSessionManager } from '../services/browser-session-manager.js';

const InputSchema = z.object({
  url: z.string().describe('The URL to navigate to'),
});

export class BrowserNavigateTool implements MCPTool {
  name = 'browser_navigate';
  description = 'Navigate to a URL in the persistent browser session';
  inputSchema = InputSchema;

  constructor(private sessionManager: BrowserSessionManager) {}

  async execute(args: z.infer<typeof InputSchema>): Promise<CallToolResult> {
    await this.sessionManager.navigate(args.url);
    return {
      content: [
        {
          type: 'text',
          text: `Navigated to ${args.url}`,
        },
      ],
    };
  }
}
