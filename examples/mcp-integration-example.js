/**
 * MCP Integration Example
 * 
 * This example demonstrates how to use the TestCafe MCP Server
 * from an MCP client to create, validate, and execute tests.
 */

import { MCPClient } from '@modelcontextprotocol/client';

class TestCafeMCPExample {
  constructor() {
    this.client = new MCPClient();
  }

  async initialize() {
    // Connect to the TestCafe MCP Server
    await this.client.connect({
      command: 'node',
      args: ['./dist/index.js'],
      cwd: process.cwd()
    });
    
    console.log('Connected to TestCafe MCP Server');
  }

  async demonstratePageInspection() {
    console.log('\n=== Page Inspection Demo ===');
    
    try {
      // Inspect a real webpage
      const inspectionResult = await this.client.callTool('inspect_page', {
        operation: 'analyze',
        target: {
          type: 'url',
          url: 'https://example.com'
        },
        executeLive: true,
        browser: 'chrome:headless',
        screenshots: true,
        screenshotPath: './inspection-screenshots',
        options: {
          includeHidden: false,
          includeText: true,
          includeAttributes: true
        }
      });

      console.log('Page inspection completed:');
      console.log(inspectionResult.content[0].text);

      // Discover specific elements
      const discoveryResult = await this.client.callTool('inspect_page', {
        operation: 'discover',
        target: {
          type: 'url',
          url: 'https://example.com'
        },
        executeLive: true,
        browser: 'chrome:headless'
      });

      console.log('\nElement discovery completed:');
      console.log(discoveryResult.content[0].text);

    } catch (error) {
      console.error('Page inspection failed:', error);
    }
  }

  async demonstrateTestCreation() {
    console.log('\n=== Test Creation Demo ===');
    
    try {
      // Create a comprehensive test
      const testResult = await this.client.callTool('create_test', {
        testStructure: {
          fixture: 'E-commerce Website Tests',
          url: 'https://example-shop.com',
          tests: [
            {
              name: 'should search for products',
              actions: [
                { type: 'navigate', value: 'https://example-shop.com' },
                { type: 'type', selector: '#search-input', value: 'laptop' },
                { type: 'click', selector: '#search-button' },
                { type: 'wait', condition: 'element', value: '.search-results' },
                { type: 'assert', selector: '.product-item' }
              ]
            },
            {
              name: 'should add product to cart',
              actions: [
                { type: 'click', selector: '.product-item:first-child' },
                { type: 'wait', condition: 'element', value: '.product-details' },
                { type: 'click', selector: '#add-to-cart' },
                { type: 'assert', selector: '.cart-notification' }
              ]
            },
            {
              name: 'should proceed to checkout',
              actions: [
                { type: 'click', selector: '#cart-icon' },
                { type: 'wait', condition: 'element', value: '.cart-items' },
                { type: 'click', selector: '#checkout-button' },
                { type: 'assert', selector: '.checkout-form' }
              ]
            }
          ]
        },
        outputPath: './examples/generated-ecommerce-test.js',
        validate: true
      });

      console.log('Test creation completed:');
      console.log(testResult.content[0].text);

    } catch (error) {
      console.error('Test creation failed:', error);
    }
  }

  async demonstrateTestValidation() {
    console.log('\n=== Test Validation Demo ===');
    
    try {
      // Validate the created test
      const validationResult = await this.client.callTool('validate_test', {
        source: {
          type: 'file',
          path: './examples/generated-ecommerce-test.js'
        },
        validationLevel: 'comprehensive',
        checkBestPractices: true,
        includeSuggestions: true
      });

      console.log('Test validation completed:');
      console.log(validationResult.content[0].text);

      // Validate test code directly
      const codeValidationResult = await this.client.callTool('validate_test', {
        source: {
          type: 'code',
          content: `
            import { Selector } from 'testcafe';
            
            fixture('Sample Test')
              .page('https://example.com');
            
            test('should work correctly', async t => {
              await t
                .click('#button')
                .expect(Selector('#result').exists).ok();
            });
          `
        },
        validationLevel: 'basic'
      });

      console.log('\nCode validation completed:');
      console.log(codeValidationResult.content[0].text);

    } catch (error) {
      console.error('Test validation failed:', error);
    }
  }

  async demonstrateLiveBrowserInteraction() {
    console.log('\n=== Live Browser Interaction Demo ===');
    
    try {
      // Perform live browser interactions
      const interactionResult = await this.client.callTool('interact', {
        actions: [
          { type: 'navigate', url: 'https://example.com' },
          { type: 'wait', condition: 'timeout', value: 2000 },
          { type: 'click', selector: 'h1' },
          { type: 'wait', condition: 'timeout', value: 1000 }
        ],
        executeLive: true,
        browser: 'chrome',
        screenshots: true,
        screenshotPath: './interaction-screenshots',
        generateTest: true,
        testName: 'Live Interaction Test',
        fixtureName: 'Live Browser Demo',
        outputPath: './examples/live-interaction-test.js'
      });

      console.log('Live browser interaction completed:');
      console.log(interactionResult.content[0].text);

    } catch (error) {
      console.error('Live browser interaction failed:', error);
    }
  }

  async demonstrateTestExecution() {
    console.log('\n=== Test Execution Demo ===');
    
    try {
      // Execute a simple test with comprehensive options
      const executionResult = await this.client.callTool('execute_test', {
        testCode: `
          import { Selector } from 'testcafe';

          fixture('MCP Demo Test')
            .page('data:text/html,<html><body><h1 id="title">Hello MCP!</h1><button id="btn" onclick="this.textContent=\\'Clicked!\\'">Click Me</button></body></html>');

          test('should interact with demo page', async t => {
            await t
              .expect(Selector('#title').innerText).eql('Hello MCP!')
              .click('#btn')
              .expect(Selector('#btn').innerText).eql('Clicked!');
          });
        `,
        browsers: ['chrome:headless'],
        reporter: 'spec',
        screenshots: true,
        screenshotPath: './execution-screenshots',
        video: false, // Disable video for demo
        speed: 1,
        timeout: 30000,
        quarantine: false,
        stopOnFirstFail: false
      });

      console.log('Test execution completed:');
      console.log(executionResult.content[0].text);

    } catch (error) {
      console.error('Test execution failed:', error);
    }
  }

  async demonstrateAdvancedWorkflow() {
    console.log('\n=== Advanced Workflow Demo ===');
    
    try {
      // 1. Inspect a page to understand its structure
      console.log('Step 1: Inspecting target page...');
      const pageAnalysis = await this.client.callTool('inspect_page', {
        operation: 'analyze',
        target: { type: 'url', url: 'https://httpbin.org/forms/post' },
        executeLive: true,
        browser: 'chrome:headless'
      });

      // 2. Create a test based on the discovered structure
      console.log('Step 2: Creating test based on page structure...');
      const testCreation = await this.client.callTool('create_test', {
        testStructure: {
          fixture: 'HTTPBin Form Test',
          url: 'https://httpbin.org/forms/post',
          tests: [{
            name: 'should submit form successfully',
            actions: [
              { type: 'type', selector: 'input[name="custname"]', value: 'John Doe' },
              { type: 'type', selector: 'input[name="custtel"]', value: '555-1234' },
              { type: 'type', selector: 'input[name="custemail"]', value: 'john@example.com' },
              { type: 'click', selector: 'input[name="size"][value="medium"]' },
              { type: 'click', selector: 'input[name="topping"][value="cheese"]' },
              { type: 'type', selector: 'textarea[name="comments"]', value: 'Test order' },
              { type: 'click', selector: 'input[type="submit"]' },
              { type: 'wait', condition: 'timeout', value: 3000 }
            ]
          }]
        },
        outputPath: './examples/httpbin-form-test.js',
        validate: true
      });

      // 3. Execute the created test
      console.log('Step 3: Executing the created test...');
      const testExecution = await this.client.callTool('execute_test', {
        testPath: './examples/httpbin-form-test.js',
        browsers: ['chrome:headless'],
        screenshots: true,
        screenshotPath: './workflow-screenshots',
        reporter: 'spec'
      });

      console.log('Advanced workflow completed successfully!');
      console.log('Final execution result:');
      console.log(testExecution.content[0].text);

    } catch (error) {
      console.error('Advanced workflow failed:', error);
    }
  }

  async runAllDemos() {
    try {
      await this.initialize();
      
      await this.demonstratePageInspection();
      await this.demonstrateTestCreation();
      await this.demonstrateTestValidation();
      await this.demonstrateLiveBrowserInteraction();
      await this.demonstrateTestExecution();
      await this.demonstrateAdvancedWorkflow();
      
      console.log('\n=== All demos completed successfully! ===');
      
    } catch (error) {
      console.error('Demo execution failed:', error);
    } finally {
      await this.client.disconnect();
    }
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const example = new TestCafeMCPExample();
  example.runAllDemos().catch(console.error);
}

export { TestCafeMCPExample };