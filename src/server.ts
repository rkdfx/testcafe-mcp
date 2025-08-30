/**
 * MCP Server Core Implementation
 * 
 * This file contains the main MCP server class that handles
 * protocol communication and tool registration.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

/**
 * Interface for MCP tools that can be registered with the server
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
  execute(args: any): Promise<CallToolResult>;
}

/**
 * Configuration options for the TestCafe MCP Server
 */
export interface ServerConfig {
  name: string;
  version: string;
  debug?: boolean;
  maxConcurrentTests?: number;
}

/**
 * TestCafe MCP Server
 * 
 * Implements the Model Context Protocol server for TestCafe operations.
 * Handles tool registration, request routing, and protocol communication.
 */
export class TestCafeMCPServer {
  private server: Server;
  private tools: Map<string, MCPTool> = new Map();
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Register an MCP tool with the server
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Register multiple MCP tools with the server
   */
  registerTools(tools: MCPTool[]): void {
    tools.forEach(tool => this.registerTool(tool));
  }

  /**
   * Get all registered tools
   */
  getRegisteredTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Start the MCP server with stdio transport
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    await this.server.close();
  }

  /**
   * Set up MCP protocol handlers
   */
  private setupHandlers(): void {
    // Handle list_tools requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: this.zodSchemaToJsonSchema(tool.inputSchema),
      }));

      return { tools };
    });

    // Handle call_tool requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.tools.get(name);
      if (!tool) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Tool '${name}' not found`
        );
      }

      try {
        // Validate input arguments against tool schema
        const validatedArgs = tool.inputSchema.parse(args);
        
        // Execute the tool
        const result = await tool.execute(validatedArgs);
        return result;
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid arguments for tool '${name}': ${error.message}`,
            { zodError: error.errors }
          );
        }
        
        // Re-throw MCP errors as-is
        if (error instanceof McpError) {
          throw error;
        }
        
        // Wrap other errors
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error }
        );
      }
    });
  }

  /**
   * Convert Zod schema to JSON Schema for MCP protocol
   * This is a simplified conversion - in a production system you might want
   * to use a more comprehensive library like zod-to-json-schema
   */
  private zodSchemaToJsonSchema(schema: z.ZodSchema<any>): any {
    // Basic conversion for common Zod types
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: any = {};
      const required: string[] = [];

      Object.entries(shape).forEach(([key, value]) => {
        properties[key] = this.zodSchemaToJsonSchema(value as z.ZodSchema<any>);
        if (!(value as any).isOptional()) {
          required.push(key);
        }
      });

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
        additionalProperties: false
      };
    }

    if (schema instanceof z.ZodString) {
      return { type: 'string' };
    }

    if (schema instanceof z.ZodNumber) {
      return { type: 'number' };
    }

    if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }

    if (schema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodSchemaToJsonSchema(schema.element)
      };
    }

    if (schema instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: schema.options
      };
    }

    if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
      return {
        oneOf: schema.options.map((option: any) => this.zodSchemaToJsonSchema(option))
      };
    }

    // Fallback for unknown types
    return {
      type: 'object',
      additionalProperties: true
    };
  }
}