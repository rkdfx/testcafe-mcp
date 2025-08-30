/**
 * Unit tests for TestCafe MCP Server request handlers
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Mock the MCP SDK before importing the server
const mockSetRequestHandler = jest.fn();
const mockServer = {
  setRequestHandler: mockSetRequestHandler,
  setNotificationHandler: jest.fn(),
  connect: jest.fn(),
  close: jest.fn(),
  sendNotification: jest.fn(),
  sendRequest: jest.fn()
};

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => mockServer)
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn()
}));

// Now import the server after mocking
import { TestCafeMCPServer, MCPTool } from '../../src/server.js';

describe('TestCafeMCPServer Request Handlers', () => {
  let server: TestCafeMCPServer;

  beforeEach(() => {
    mockSetRequestHandler.mockClear();
    
    server = new TestCafeMCPServer({
      name: 'test-server',
      version: '1.0.0'
    });
  });

  describe('server initialization', () => {
    it('should create server instance', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(TestCafeMCPServer);
    });

    it('should register request handlers', () => {
      // Should have registered handlers for list_tools and call_tool
      expect(mockSetRequestHandler).toHaveBeenCalled();
      
      // Check that handlers were registered (the exact number may vary based on implementation)
      expect(mockSetRequestHandler.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('tool registration', () => {
    it('should register a single tool', () => {
      const mockTool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ param: z.string() }),
        execute: jest.fn()
      };

      server.registerTool(mockTool);
      const tools = server.getRegisteredTools();
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
    });

    it('should register multiple tools', () => {
      const tools: MCPTool[] = [
        {
          name: 'tool-1',
          description: 'First tool',
          inputSchema: z.object({ param: z.string() }),
          execute: jest.fn()
        },
        {
          name: 'tool-2',
          description: 'Second tool',
          inputSchema: z.object({ value: z.number() }),
          execute: jest.fn()
        }
      ];

      server.registerTools(tools);
      const registeredTools = server.getRegisteredTools();
      
      expect(registeredTools).toHaveLength(2);
      expect(registeredTools.map(t => t.name)).toEqual(['tool-1', 'tool-2']);
    });
  });

  describe('basic functionality', () => {
    it('should start and stop server', async () => {
      await expect(server.start()).resolves.not.toThrow();
      await expect(server.stop()).resolves.not.toThrow();
    });
  });
});