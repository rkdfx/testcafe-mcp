/**
 * Browser Evaluate Tool
 *
 * MCP tool for evaluating JavaScript expressions in the browser context.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import { BrowserSessionManager } from '../services/browser-session-manager.js';

const InputSchema = z.object({
  function: z
    .string()
    .describe(
      '() => { /* code */ } or (element) => { /* code */ } when element is provided',
    ),
  ref: z
    .string()
    .optional()
    .describe(
      'Exact target element reference from the page snapshot',
    ),
  element: z
    .string()
    .optional()
    .describe(
      'Human-readable element description used to obtain permission to interact with the element',
    ),
});

export class BrowserEvaluateTool implements MCPTool {
  name = 'browser_evaluate';
  description = 'Evaluate JavaScript expression on page or element';
  inputSchema = InputSchema;

  constructor(private sessionManager: BrowserSessionManager) {}

  async execute(args: z.infer<typeof InputSchema>): Promise<CallToolResult> {
    const result = await this.sessionManager.evaluate(args.function, args.ref);
    return {
      content: [
        {
          type: 'text',
          text:
            result === undefined ? 'undefined' : JSON.stringify(result, null, 2),
        },
      ],
    };
  }
}
