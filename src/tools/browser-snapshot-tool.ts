/**
 * Browser Snapshot Tool
 *
 * MCP tool that captures an accessibility snapshot of the current page.
 * Returns a formatted text tree with ref IDs on interactive elements.
 * Use the ref IDs with other browser_* tools to interact with elements.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import { BrowserSessionManager } from '../services/browser-session-manager.js';

const InputSchema = z.object({});

export class BrowserSnapshotTool implements MCPTool {
  name = 'browser_snapshot';
  description =
    'Capture accessibility snapshot of the current page, this is better than screenshot';
  inputSchema = InputSchema;

  constructor(private sessionManager: BrowserSessionManager) {}

  async execute(): Promise<CallToolResult> {
    const tree = await this.sessionManager.snapshot();
    return {
      content: [
        {
          type: 'text',
          text: tree,
        },
      ],
    };
  }
}
