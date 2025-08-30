#!/usr/bin/env node

/**
 * TestCafe MCP Server Entry Point
 * 
 * This is the main entry point for the TestCafe MCP server.
 * It initializes and starts the MCP server to handle TestCafe operations.
 */

import { TestCafeMCPServer } from './server.js';
import { ConfigManager } from './config/index.js';
import { TestCafeService } from './services/index.js';
import {
  CreateTestTool,
  ExecuteTestTool,
  ValidateTestTool,
  InteractTool,
  InspectPageTool
} from './tools/index.js';

async function main() {
  try {
    // Initialize configuration
    const configManager = new ConfigManager({
      server: {
        name: 'testcafe-mcp-server',
        version: '1.0.0',
        debug: process.env.DEBUG === 'true',
        maxConcurrentTests: parseInt(process.env.MAX_CONCURRENT_TESTS || '3')
      }
    });

    const config = configManager.getConfig();

    // Initialize services
    const testCafeService = new TestCafeService(config.testcafe);

    // Initialize server
    const server = new TestCafeMCPServer(config.server);

    // Register all tools
    const tools = [
      new CreateTestTool(testCafeService),
      new ExecuteTestTool(testCafeService),
      new ValidateTestTool(testCafeService),
      new InteractTool(),
      new InspectPageTool()
    ];

    server.registerTools(tools);

    // Set up graceful shutdown
    const shutdown = async (signal: string) => {
      console.error(`Received ${signal}, shutting down gracefully...`);
      try {
        await testCafeService.close();
        await server.stop();
        console.error('TestCafe MCP Server stopped successfully');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

    // Start server
    await server.start();
    
    if (config.server.debug) {
      console.error('TestCafe MCP Server started in debug mode');
      console.error(`Registered tools: ${tools.map(t => t.name).join(', ')}`);
      console.error(`Configuration: ${JSON.stringify(config, null, 2)}`);
    } else {
      console.error('TestCafe MCP Server started successfully');
    }

  } catch (error) {
    console.error('Failed to start TestCafe MCP Server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});