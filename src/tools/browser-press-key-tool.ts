/**
 * Browser Press Key Tool
 *
 * MCP tool for pressing a keyboard key in the persistent browser session.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import { BrowserSessionManager } from '../services/browser-session-manager.js';

const InputSchema = z.object({
  key: z
    .string()
    .describe(
      'Name of the key to press or a character to generate, such as `ArrowLeft` or `a`',
    ),
});

export class BrowserPressKeyTool implements MCPTool {
  name = 'browser_press_key';
  description = 'Press a key on the keyboard';
  inputSchema = InputSchema;

  constructor(private sessionManager: BrowserSessionManager) {}

  async execute(args: z.infer<typeof InputSchema>): Promise<CallToolResult> {
    await this.sessionManager.pressKey(args.key);
    return {
      content: [
        {
          type: 'text',
          text: `Pressed key: ${args.key}`,
        },
      ],
    };
  }
}
