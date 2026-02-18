/**
 * Browser Type Tool
 *
 * MCP tool for typing text into an element identified by its snapshot ref.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import { BrowserSessionManager } from '../services/browser-session-manager.js';

const InputSchema = z.object({
  ref: z.string().describe('Exact target element reference from the page snapshot'),
  text: z.string().describe('Text to type into the element'),
  element: z
    .string()
    .optional()
    .describe('Human-readable element description used to obtain permission to interact with the element'),
  submit: z
    .boolean()
    .optional()
    .describe('Whether to submit entered text (press Enter after)'),
  slowly: z
    .boolean()
    .optional()
    .describe(
      'Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.',
    ),
});

export class BrowserTypeTool implements MCPTool {
  name = 'browser_type';
  description = 'Type text into editable element';
  inputSchema = InputSchema;

  constructor(private sessionManager: BrowserSessionManager) {}

  async execute(args: z.infer<typeof InputSchema>): Promise<CallToolResult> {
    await this.sessionManager.type(args.ref, args.text, {
      submit: args.submit,
      slowly: args.slowly,
    });
    return {
      content: [
        {
          type: 'text',
          text: `Typed "${args.text}" into ${args.element ?? args.ref}${args.submit ? ' and submitted' : ''}`,
        },
      ],
    };
  }
}
