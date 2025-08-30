/**
 * Unit tests for TestCafeMCPServer
 */

// Mock the MCP SDK before importing
const mockServer = {
  setRequestHandler: jest.fn(),
  setNotificationHandler: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined)
};

const mockStdioTransport = jest.fn();

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => mockServer)
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: mockStdioTransport
}));

import { TestCafeMCPServer } from '../../src/server.js';
import { z } from 'zod';

describe('TestCafeMCPServer', () => {
  let server: TestCafeMCPServer;

  beforeEach(() => {
    jest.clearAllMocks();
    server = new TestCafeMCPServer({
      name: 'test-server',
      version: '1.0.0'
    });
  });

  describe('constructor', () => {
    it('should create server instance', () => {
      expect(server).toBeInstanceOf(TestCafeMCPServer);
    });

    it('should setup request handlers', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('tool registration', () => {
    it('should register a single tool', () => {
      const mockTool = {
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: z.object({ value: z.string() }),
        execute: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Success' }]
        })
      };

      server.registerTool(mockTool);
      const tools = server.getRegisteredTools();
      
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBe(mockTool);
    });

    it('should register multiple tools', () => {
      const mockTool1 = {
        name: 'tool-1',
        description: 'Tool 1',
        inputSchema: z.object({ value: z.string() }),
        execute: jest.fn()
      };

      const mockTool2 = {
        name: 'tool-2',
        description: 'Tool 2',
        inputSchema: z.object({ value: z.string() }),
        execute: jest.fn()
      };

      server.registerTools([mockTool1, mockTool2]);
      const tools = server.getRegisteredTools();
      
      expect(tools).toHaveLength(2);
    });
  });

  describe('server lifecycle', () => {
    it('should start server', async () => {
      await expect(server.start()).resolves.toBeUndefined();
      expect(mockServer.connect).toHaveBeenCalledTimes(1);
    });

    it('should stop server', async () => {
      await expect(server.stop()).resolves.toBeUndefined();
      expect(mockServer.close).toHaveBeenCalledTimes(1);
    });
  });
});
