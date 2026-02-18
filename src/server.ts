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
        // Preprocess arguments to handle string coercion issues from AI clients
        const preprocessedArgs = this.preprocessArguments(args);

        // Validate input arguments against tool schema
        const validatedArgs = tool.inputSchema.parse(preprocessedArgs);

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
   * Preprocess arguments to handle common type coercion issues
   * AI clients sometimes send strings when they should send objects or booleans
   */
  private preprocessArguments(args: any): any {
    if (args === null || args === undefined) {
      return args;
    }

    // Handle arrays
    if (Array.isArray(args)) {
      return args.map(item => this.preprocessArguments(item));
    }

    // Handle objects
    if (typeof args === 'object') {
      const processed: any = {};
      for (const [key, value] of Object.entries(args)) {
        processed[key] = this.preprocessValue(key, value);
      }
      return processed;
    }

    return args;
  }

  /**
   * Preprocess a single value with context-aware coercion
   */
  private preprocessValue(key: string, value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Recursively process arrays
    if (Array.isArray(value)) {
      return value.map(item => this.preprocessArguments(item));
    }

    // Check if this is a boolean field based on common naming patterns
    const booleanFieldPatterns = [
      'screenshots?', 'executeLive', 'generateCode', 'generateTest', 'autoHandle',
      'includeHidden', 'includeText', 'includeAttributes',
      'validate', 'overwrite', 'headless', 'debug',
      'isVisible', 'isEnabled', 'required', 'optional',
      'replace', 'paste', 'confidential', 'saveToFile',
      'ctrl', 'alt', 'shift', 'meta',  // modifier keys
      'submit', 'slowly', 'doubleClick', 'fullPage',  // browser tools
      'includeWarnings', 'includeSuggestions', 'includeStatic',
      'includeHeaders', 'includeBody'
    ];

    const isBooleanField = booleanFieldPatterns.some(pattern =>
      new RegExp(`^${pattern}$`, 'i').test(key)
    );

    // Handle object to boolean coercion (AI clients sometimes send objects for booleans)
    if (typeof value === 'object' && !Array.isArray(value) && isBooleanField) {
      // Empty object - return undefined to use schema default
      if (Object.keys(value).length === 0) {
        return undefined;
      }

      // Object with a boolean-like property
      if ('value' in value && typeof value.value === 'boolean') {
        return value.value;
      }
      if ('enabled' in value && typeof value.enabled === 'boolean') {
        return value.enabled;
      }

      // If object has any truthy properties, consider it true
      const hasProperties = Object.keys(value).length > 0;
      return hasProperties;
    }

    // Recursively process non-boolean objects
    if (typeof value === 'object' && !Array.isArray(value)) {
      return this.preprocessArguments(value);
    }

    // Handle string to boolean coercion for common boolean field names
    if (typeof value === 'string' && isBooleanField) {
      // Convert string booleans to actual booleans
      if (value.toLowerCase() === 'true' || value === '1') return true;
      if (value.toLowerCase() === 'false' || value === '0') return false;
    }

    // Handle target field special case - if target is a string, convert to object
    if (key === 'target' && typeof value === 'string') {
      // Common patterns: "url", "current-page", "element"
      if (value === 'current-page') {
        return { type: 'current-page' };
      }
      // If it looks like a URL, create a url target
      try {
        new URL(value);
        return { type: 'url', url: value };
      } catch {
        // Not a URL, might be a selector - create element target
        return { type: 'element', selector: value };
      }
    }

    // Try to parse JSON strings that look like objects/arrays
    if (typeof value === 'string') {
      if ((value.startsWith('{') && value.endsWith('}')) ||
          (value.startsWith('[') && value.endsWith(']'))) {
        try {
          return JSON.parse(value);
        } catch {
          // Not valid JSON, return as-is
          return value;
        }
      }
    }

    // Handle string to number coercion for common numeric fields
    if (typeof value === 'string') {
      const numericFieldPatterns = [
        'waitTime', 'timeout', 'maxDepth', 'maxLogs',
        'concurrency', 'speed', 'port', 'retries'
      ];

      const isNumericField = numericFieldPatterns.some(pattern =>
        new RegExp(`^${pattern}$`, 'i').test(key)
      );

      if (isNumericField && /^\d+(\.\d+)?$/.test(value)) {
        const num = Number(value);
        if (!isNaN(num)) return num;
      }
    }

    return value;
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

    // Unwrap ZodOptional, ZodDefault, ZodNullable to get the inner schema
    if (schema instanceof z.ZodOptional) {
      return this.zodSchemaToJsonSchema((schema as any)._def.innerType);
    }

    if (schema instanceof z.ZodDefault) {
      return this.zodSchemaToJsonSchema((schema as any)._def.innerType);
    }

    if (schema instanceof z.ZodNullable) {
      return this.zodSchemaToJsonSchema((schema as any)._def.innerType);
    }

    // Fallback for unknown types
    return {
      type: 'object',
      additionalProperties: true
    };
  }
}