/**
 * Example MCP client usage for TestCafe MCP Server
 * 
 * This example shows how to interact with the TestCafe MCP Server
 * from an MCP client application.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  // Create MCP client
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js']
  });

  const client = new Client(
    {
      name: 'testcafe-mcp-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  try {
    // Connect to server
    await client.connect(transport);
    console.log('Connected to TestCafe MCP Server');

    // List available tools
    const toolsResponse = await client.request(
      { method: 'tools/list' },
      {}
    );
    console.log('Available tools:', toolsResponse.tools.map(t => t.name));

    // Example 1: Create a test
    console.log('\n--- Creating Test ---');
    const createTestResult = await client.request(
      { method: 'tools/call' },
      {
        name: 'create_test',
        arguments: {
          testStructure: {
            fixture: 'Example Test Suite',
            url: 'https://example.com',
            tests: [{
              name: 'Basic navigation test',
              actions: [
                { type: 'navigate', value: 'https://example.com' },
                { type: 'click', selector: '#menu-button' },
                { type: 'assert', selector: '.menu-dropdown' }
              ]
            }]
          },
          outputPath: './generated-test.js',
          validate: true
        }
      }
    );
    console.log('Test creation result:', createTestResult.content[0].text);

    // Example 2: Validate test code
    console.log('\n--- Validating Test ---');
    const validateResult = await client.request(
      { method: 'tools/call' },
      {
        name: 'validate_test',
        arguments: {
          source: {
            type: 'file',
            path: './generated-test.js'
          },
          validationLevel: 'comprehensive',
          includeWarnings: true,
          includeSuggestions: true
        }
      }
    );
    console.log('Validation result:', validateResult.content[0].text);

    // Example 3: Generate browser interactions
    console.log('\n--- Browser Interactions ---');
    const interactResult = await client.request(
      { method: 'tools/call' },
      {
        name: 'interact',
        arguments: {
          actions: [
            {
              type: 'navigate',
              url: 'https://example.com/form'
            },
            {
              type: 'type',
              selector: '#email',
              text: 'test@example.com'
            },
            {
              type: 'type',
              selector: '#message',
              text: 'Hello from MCP!'
            },
            {
              type: 'click',
              selector: '#submit-button'
            },
            {
              type: 'assert',
              assertion: 'visible',
              selector: '.success-message'
            }
          ],
          generateTest: true,
          testName: 'Contact form submission',
          fixtureName: 'Contact Form Tests',
          outputPath: './contact-form-test.js'
        }
      }
    );
    console.log('Interaction result:', interactResult.content[0].text);

    // Example 4: Page inspection
    console.log('\n--- Page Inspection ---');
    const inspectResult = await client.request(
      { method: 'tools/call' },
      {
        name: 'inspect_page',
        arguments: {
          operation: 'analyze',
          target: {
            type: 'url',
            url: 'https://example.com'
          },
          options: {
            includeHidden: false,
            includeText: true,
            includeAttributes: true
          }
        }
      }
    );
    console.log('Page inspection result:', inspectResult.content[0].text);

    // Example 5: Execute test (if TestCafe is available)
    console.log('\n--- Test Execution ---');
    try {
      const executeResult = await client.request(
        { method: 'tools/call' },
        {
          name: 'execute_test',
          arguments: {
            testPath: './generated-test.js',
            browsers: ['chrome:headless'],
            reporter: 'spec',
            screenshots: true,
            screenshotPath: './screenshots'
          }
        }
      );
      console.log('Execution result:', executeResult.content[0].text);
    } catch (error) {
      console.log('Test execution skipped (TestCafe not configured):', error.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close connection
    await client.close();
    console.log('\nDisconnected from TestCafe MCP Server');
  }
}

// Run example
main().catch(console.error);