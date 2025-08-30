/**
 * Advanced Testing Patterns with TestCafe MCP Server
 * 
 * This example demonstrates sophisticated testing patterns and workflows
 * using the TestCafe MCP Server for complex web application testing.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class AdvancedTestingPatterns {
  constructor() {
    this.client = null;
    this.testResults = [];
  }

  async initialize() {
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js']
    });

    this.client = new Client(
      { name: 'advanced-testing-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await this.client.connect(transport);
    console.log('🚀 Connected to TestCafe MCP Server');
  }

  /**
   * Pattern 1: Data-Driven Testing
   * Generate tests with multiple data sets
   */
  async dataDrivenTesting() {
    console.log('\n=== Data-Driven Testing Pattern ===');

    const testData = [
      { username: 'admin@example.com', password: 'admin123', role: 'admin' },
      { username: 'user@example.com', password: 'user123', role: 'user' },
      { username: 'guest@example.com', password: 'guest123', role: 'guest' }
    ];

    const testActions = testData.map((data, index) => ({
      name: `should login as ${data.role}`,
      actions: [
        { type: 'navigate', value: 'https://example.com/login' },
        { type: 'type', selector: '#username', value: data.username },
        { type: 'type', selector: '#password', value: data.password },
        { type: 'click', selector: '#login-button' },
        { type: 'wait', condition: 'element', value: `.${data.role}-dashboard`, timeout: 5000 },
        { type: 'assert', selector: `.${data.role}-dashboard` },
        { type: 'assert', selector: `[data-role="${data.role}"]` }
      ]
    }));

    const result = await this.client.request(
      { method: 'tools/call' },
      {
        name: 'create_test',
        arguments: {
          testStructure: {
            fixture: 'Data-Driven Login Tests',
            url: 'https://example.com/login',
            beforeEach: [
              { type: 'navigate', value: 'https://example.com/logout' },
              { type: 'wait', condition: 'timeout', value: 1000 }
            ],
            tests: testActions
          },
          outputPath: './tests/data-driven-login.test.js',
          validate: true
        }
      }
    );

    console.log('✅ Data-driven tests created successfully');
    return result;
  }

  /**
   * Pattern 2: Page Object Model Implementation
   * Create tests using page object pattern
   */
  async pageObjectModelTesting() {
    console.log('\n=== Page Object Model Pattern ===');

    // First, analyze the page to understand its structure
    const pageAnalysis = await this.client.request(
      { method: 'tools/call' },
      {
        name: 'inspect_page',
        arguments: {
          operation: 'analyze',
          target: { type: 'url', url: 'https://example.com/checkout' },
          executeLive: true,
          browser: 'chrome:headless',
          options: {
            includeAttributes: true,
            filterByTag: ['form', 'input', 'button', 'select']
          }
        }
      }
    );

    // Create page object-based tests
    const pageObjectTests = await this.client.request(
      { method: 'tools/call' },
      {
        name: 'create_test',
        arguments: {
          testStructure: {
            fixture: 'Checkout Page Object Tests',
            url: 'https://example.com/checkout',
            beforeEach: [
              { type: 'navigate', value: 'https://example.com/cart' },
              { type: 'click', selector: '#proceed-to-checkout' }
            ],
            tests: [
              {
                name: 'should complete checkout with billing information',
                actions: [
                  // Billing information section
                  { type: 'type', selector: '[data-testid="billing-first-name"]', value: 'John' },
                  { type: 'type', selector: '[data-testid="billing-last-name"]', value: 'Doe' },
                  { type: 'type', selector: '[data-testid="billing-email"]', value: 'john.doe@example.com' },
                  { type: 'type', selector: '[data-testid="billing-phone"]', value: '+1-555-123-4567' },
                  
                  // Address information
                  { type: 'type', selector: '[data-testid="billing-address"]', value: '123 Main Street' },
                  { type: 'type', selector: '[data-testid="billing-city"]', value: 'Anytown' },
                  { type: 'click', selector: '[data-testid="billing-state"]' },
                  { type: 'click', selector: '[data-testid="state-option-ca"]' },
                  { type: 'type', selector: '[data-testid="billing-zip"]', value: '12345' },
                  
                  // Payment information
                  { type: 'type', selector: '[data-testid="card-number"]', value: '4111111111111111' },
                  { type: 'type', selector: '[data-testid="card-expiry"]', value: '12/25' },
                  { type: 'type', selector: '[data-testid="card-cvc"]', value: '123' },
                  { type: 'type', selector: '[data-testid="card-name"]', value: 'John Doe' },
                  
                  // Submit and verify
                  { type: 'click', selector: '[data-testid="place-order-button"]' },
                  { type: 'wait', condition: 'element', value: '[data-testid="order-confirmation"]', timeout: 10000 },
                  { type: 'assert', selector: '[data-testid="order-number"]' },
                  { type: 'assert', selector: '[data-testid="order-total"]' }
                ]
              },
              {
                name: 'should validate required fields',
                actions: [
                  { type: 'click', selector: '[data-testid="place-order-button"]' },
                  { type: 'assert', selector: '[data-testid="error-billing-first-name"]' },
                  { type: 'assert', selector: '[data-testid="error-billing-email"]' },
                  { type: 'assert', selector: '[data-testid="error-card-number"]' }
                ]
              }
            ]
          },
          outputPath: './tests/checkout-page-object.test.js',
          validate: true
        }
      }
    );

    console.log('✅ Page object model tests created');
    return { pageAnalysis, pageObjectTests };
  }

  /**
   * Pattern 3: Cross-Browser Testing
   * Execute tests across multiple browsers
   */
  async crossBrowserTesting() {
    console.log('\n=== Cross-Browser Testing Pattern ===');

    const browsers = ['chrome:headless', 'firefox:headless'];
    const testResults = [];

    for (const browser of browsers) {
      console.log(`Testing with ${browser}...`);

      const result = await this.client.request(
        { method: 'tools/call' },
        {
          name: 'execute_test',
          arguments: {
            testPath: './tests/checkout-page-object.test.js',
            browsers: [browser],
            screenshots: true,
            screenshotPath: `./screenshots/${browser.replace(':', '-')}`,
            video: false, // Disable video for performance
            reporter: 'json',
            speed: 1,
            timeout: 45000
          }
        }
      );

      testResults.push({
        browser,
        result: JSON.parse(result.content[0].text)
      });
    }

    console.log('✅ Cross-browser testing completed');
    return testResults;
  }

  /**
   * Pattern 4: Visual Regression Testing
   * Capture and compare screenshots
   */
  async visualRegressionTesting() {
    console.log('\n=== Visual Regression Testing Pattern ===');

    const pages = [
      'https://example.com/home',
      'https://example.com/products',
      'https://example.com/about',
      'https://example.com/contact'
    ];

    const visualTests = pages.map((url, index) => ({
      name: `should capture visual baseline for ${url.split('/').pop()}`,
      actions: [
        { type: 'navigate', value: url },
        { type: 'wait', condition: 'timeout', value: 3000 }, // Wait for page to stabilize
        { type: 'assert', selector: 'body' } // Ensure page loaded
      ]
    }));

    const result = await this.client.request(
      { method: 'tools/call' },
      {
        name: 'create_test',
        arguments: {
          testStructure: {
            fixture: 'Visual Regression Tests',
            url: 'https://example.com',
            tests: visualTests
          },
          outputPath: './tests/visual-regression.test.js',
          validate: true
        }
      }
    );

    // Execute with screenshot capture
    const executionResult = await this.client.request(
      { method: 'tools/call' },
      {
        name: 'execute_test',
        arguments: {
          testPath: './tests/visual-regression.test.js',
          browsers: ['chrome:headless'],
          screenshots: true,
          screenshotPath: './visual-baselines',
          reporter: 'spec'
        }
      }
    );

    console.log('✅ Visual regression baselines captured');
    return { result, executionResult };
  }

  /**
   * Pattern 5: API Integration Testing
   * Test web app with API interactions
   */
  async apiIntegrationTesting() {
    console.log('\n=== API Integration Testing Pattern ===');

    const apiTests = await this.client.request(
      { method: 'tools/call' },
      {
        name: 'create_test',
        arguments: {
          testStructure: {
            fixture: 'API Integration Tests',
            url: 'https://example.com/dashboard',
            beforeEach: [
              // Login to get authentication token
              { type: 'navigate', value: 'https://example.com/login' },
              { type: 'type', selector: '#username', value: 'testuser@example.com' },
              { type: 'type', selector: '#password', value: 'testpass123' },
              { type: 'click', selector: '#login-button' },
              { type: 'wait', condition: 'element', value: '.dashboard' }
            ],
            tests: [
              {
                name: 'should load user data from API',
                actions: [
                  { type: 'navigate', value: 'https://example.com/profile' },
                  { type: 'wait', condition: 'element', value: '[data-testid="user-profile"]', timeout: 10000 },
                  { type: 'assert', selector: '[data-testid="user-name"]' },
                  { type: 'assert', selector: '[data-testid="user-email"]' },
                  { type: 'assert', selector: '[data-testid="user-avatar"]' }
                ]
              },
              {
                name: 'should update profile via API',
                actions: [
                  { type: 'navigate', value: 'https://example.com/profile/edit' },
                  { type: 'type', selector: '#first-name', value: 'Updated' },
                  { type: 'type', selector: '#last-name', value: 'Name' },
                  { type: 'click', selector: '#save-profile' },
                  { type: 'wait', condition: 'element', value: '.success-message', timeout: 5000 },
                  { type: 'assert', selector: '.success-message' },
                  
                  // Verify the update persisted
                  { type: 'navigate', value: 'https://example.com/profile' },
                  { type: 'wait', condition: 'element', value: '[data-testid="user-name"]' },
                  { type: 'assert', selector: '[data-testid="user-name"]:contains("Updated Name")' }
                ]
              },
              {
                name: 'should handle API errors gracefully',
                actions: [
                  // Simulate network error by navigating to invalid endpoint
                  { type: 'navigate', value: 'https://example.com/api/invalid-endpoint' },
                  { type: 'wait', condition: 'timeout', value: 3000 },
                  { type: 'navigate', value: 'https://example.com/dashboard' },
                  { type: 'wait', condition: 'element', value: '.error-message, .dashboard', timeout: 10000 },
                  // Should either show error message or fallback to cached data
                  { type: 'assert', selector: '.dashboard, .error-message' }
                ]
              }
            ]
          },
          outputPath: './tests/api-integration.test.js',
          validate: true
        }
      }
    );

    console.log('✅ API integration tests created');
    return apiTests;
  }

  /**
   * Pattern 6: Performance Testing
   * Monitor performance metrics during tests
   */
  async performanceTesting() {
    console.log('\n=== Performance Testing Pattern ===');

    const performanceTests = await this.client.request(
      { method: 'tools/call' },
      {
        name: 'create_test',
        arguments: {
          testStructure: {
            fixture: 'Performance Tests',
            url: 'https://example.com',
            tests: [
              {
                name: 'should load homepage within performance budget',
                actions: [
                  { type: 'navigate', value: 'https://example.com' },
                  { type: 'wait', condition: 'element', value: 'main', timeout: 5000 },
                  { type: 'assert', selector: 'main' }
                ]
              },
              {
                name: 'should handle large data sets efficiently',
                actions: [
                  { type: 'navigate', value: 'https://example.com/products?limit=1000' },
                  { type: 'wait', condition: 'element', value: '.product-grid', timeout: 10000 },
                  { type: 'assert', selector: '.product-item' },
                  
                  // Test scrolling performance
                  { type: 'scroll', selector: 'body', value: 'bottom' },
                  { type: 'wait', condition: 'timeout', value: 2000 },
                  { type: 'scroll', selector: 'body', value: 'top' }
                ]
              }
            ]
          },
          outputPath: './tests/performance.test.js',
          validate: true
        }
      }
    );

    // Execute with performance monitoring
    const executionResult = await this.client.request(
      { method: 'tools/call' },
      {
        name: 'execute_test',
        arguments: {
          testPath: './tests/performance.test.js',
          browsers: ['chrome:headless'],
          speed: 1, // Full speed for realistic performance testing
          timeout: 30000,
          reporter: 'json'
        }
      }
    );

    console.log('✅ Performance tests completed');
    return { performanceTests, executionResult };
  }

  /**
   * Pattern 7: Accessibility Testing
   * Test for accessibility compliance
   */
  async accessibilityTesting() {
    console.log('\n=== Accessibility Testing Pattern ===');

    const a11yTests = await this.client.request(
      { method: 'tools/call' },
      {
        name: 'create_test',
        arguments: {
          testStructure: {
            fixture: 'Accessibility Tests',
            url: 'https://example.com',
            tests: [
              {
                name: 'should have proper heading structure',
                actions: [
                  { type: 'navigate', value: 'https://example.com' },
                  { type: 'assert', selector: 'h1' }, // Should have exactly one h1
                  { type: 'assert', selector: 'h2, h3, h4, h5, h6' } // Should have proper heading hierarchy
                ]
              },
              {
                name: 'should have alt text for images',
                actions: [
                  { type: 'navigate', value: 'https://example.com' },
                  { type: 'assert', selector: 'img[alt]' }, // All images should have alt attributes
                  { type: 'assert', selector: 'img:not([alt=""]):not([role="presentation"])' }
                ]
              },
              {
                name: 'should be keyboard navigable',
                actions: [
                  { type: 'navigate', value: 'https://example.com' },
                  { type: 'click', selector: 'body' }, // Focus on body
                  
                  // Tab through interactive elements
                  { type: 'key', value: 'Tab' },
                  { type: 'wait', condition: 'timeout', value: 500 },
                  { type: 'key', value: 'Tab' },
                  { type: 'wait', condition: 'timeout', value: 500 },
                  { type: 'key', value: 'Tab' },
                  
                  // Should be able to activate focused element
                  { type: 'key', value: 'Enter' }
                ]
              },
              {
                name: 'should have proper form labels',
                actions: [
                  { type: 'navigate', value: 'https://example.com/contact' },
                  { type: 'assert', selector: 'input[id]' }, // Inputs should have IDs
                  { type: 'assert', selector: 'label[for]' }, // Labels should reference inputs
                  { type: 'assert', selector: 'input[required][aria-required="true"], input[required]:not([aria-required])' }
                ]
              }
            ]
          },
          outputPath: './tests/accessibility.test.js',
          validate: true
        }
      }
    );

    console.log('✅ Accessibility tests created');
    return a11yTests;
  }

  /**
   * Pattern 8: Mobile Responsive Testing
   * Test responsive design across different viewports
   */
  async responsiveTesting() {
    console.log('\n=== Responsive Testing Pattern ===');

    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1920, height: 1080 }
    ];

    const responsiveTests = viewports.map(viewport => ({
      name: `should display correctly on ${viewport.name}`,
      actions: [
        { type: 'navigate', value: 'https://example.com' },
        { type: 'resize', width: viewport.width, height: viewport.height },
        { type: 'wait', condition: 'timeout', value: 2000 }, // Wait for responsive adjustments
        
        // Test navigation visibility
        { type: 'assert', selector: '.navigation' },
        
        // Test content layout
        { type: 'assert', selector: '.main-content' },
        
        // Test mobile-specific elements
        ...(viewport.name === 'mobile' ? [
          { type: 'assert', selector: '.mobile-menu-toggle' }
        ] : []),
        
        // Test desktop-specific elements
        ...(viewport.name === 'desktop' ? [
          { type: 'assert', selector: '.desktop-sidebar' }
        ] : [])
      ]
    }));

    const result = await this.client.request(
      { method: 'tools/call' },
      {
        name: 'create_test',
        arguments: {
          testStructure: {
            fixture: 'Responsive Design Tests',
            url: 'https://example.com',
            tests: responsiveTests
          },
          outputPath: './tests/responsive.test.js',
          validate: true
        }
      }
    );

    console.log('✅ Responsive tests created');
    return result;
  }

  /**
   * Execute all advanced testing patterns
   */
  async runAllPatterns() {
    try {
      await this.initialize();

      console.log('🧪 Running Advanced Testing Patterns...\n');

      // Execute all patterns
      const results = {
        dataDriven: await this.dataDrivenTesting(),
        pageObject: await this.pageObjectModelTesting(),
        crossBrowser: await this.crossBrowserTesting(),
        visualRegression: await this.visualRegressionTesting(),
        apiIntegration: await this.apiIntegrationTesting(),
        performance: await this.performanceTesting(),
        accessibility: await this.accessibilityTesting(),
        responsive: await this.responsiveTesting()
      };

      console.log('\n🎉 All advanced testing patterns completed successfully!');
      console.log('\nGenerated test files:');
      console.log('- ./tests/data-driven-login.test.js');
      console.log('- ./tests/checkout-page-object.test.js');
      console.log('- ./tests/visual-regression.test.js');
      console.log('- ./tests/api-integration.test.js');
      console.log('- ./tests/performance.test.js');
      console.log('- ./tests/accessibility.test.js');
      console.log('- ./tests/responsive.test.js');

      return results;

    } catch (error) {
      console.error('❌ Error running advanced testing patterns:', error);
      throw error;
    } finally {
      if (this.client) {
        await this.client.close();
      }
    }
  }
}

// Export for use in other modules
export { AdvancedTestingPatterns };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const patterns = new AdvancedTestingPatterns();
  patterns.runAllPatterns().catch(console.error);
}