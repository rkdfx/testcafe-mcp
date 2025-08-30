# TestCafe MCP Server API Documentation

## Overview

The TestCafe MCP Server provides a comprehensive API for browser automation and testing through the Model Context Protocol. This document details all available tools, their parameters, and usage examples.

## Quick Reference

| Tool | Purpose | Live Execution | Test Generation |
|------|---------|----------------|-----------------|
| `create_test` | Generate TestCafe test files | ❌ | ✅ |
| `execute_test` | Run TestCafe tests | ✅ | ❌ |
| `validate_test` | Validate test code and structure | ❌ | ❌ |
| `interact` | Perform browser interactions | ✅ | ✅ |
| `inspect_page` | Analyze web page structure | ✅ | ❌ |

## Server Information

- **Protocol Version**: MCP 1.0
- **Server Name**: testcafe-mcp-server
- **Server Version**: 1.0.0
- **Supported Capabilities**: tools, resources

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Tools](#tools)
  - [create_test](#create_test)
  - [execute_test](#execute_test)
  - [validate_test](#validate_test)
  - [interact](#interact)
  - [inspect_page](#inspect_page)
- [Data Types](#data-types)
- [Examples](#examples)

## Authentication

The TestCafe MCP Server uses the standard MCP authentication mechanism. No additional authentication is required beyond the MCP connection.

## Error Handling

All tools return standardized error responses with the following structure:

```typescript
interface MCPError {
  code: ErrorCode;
  message: string;
  data?: any;
}
```

Common error codes:
- `InvalidParams`: Invalid input parameters
- `InternalError`: Server-side execution error
- `MethodNotFound`: Unknown tool name
- `ParseError`: JSON parsing error

## Tools

### create_test

Creates TestCafe test files from structured test definitions.

#### Input Schema

```typescript
interface CreateTestInput {
  testStructure: TestStructure;
  outputPath?: string;
  validate?: boolean;
  overwrite?: boolean;
}

interface TestStructure {
  fixture: string;
  url?: string;
  beforeEach?: ActionDefinition[];
  afterEach?: ActionDefinition[];
  tests: TestDefinition[];
}

interface TestDefinition {
  name: string;
  actions: ActionDefinition[];
  skip?: boolean;
  only?: boolean;
}

interface ActionDefinition {
  type: 'navigate' | 'click' | 'type' | 'wait' | 'assert' | 'hover' | 'scroll';
  selector?: string;
  value?: string;
  timeout?: number;
  options?: ActionOptions;
}
```

#### Response

```typescript
interface CreateTestResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}
```

#### Example

```javascript
const result = await mcpClient.callTool('create_test', {
  testStructure: {
    fixture: 'User Authentication',
    url: 'https://app.example.com/login',
    beforeEach: [
      { type: 'navigate', value: 'https://app.example.com/login' }
    ],
    tests: [
      {
        name: 'should login with valid credentials',
        actions: [
          { type: 'type', selector: '#email', value: 'user@example.com' },
          { type: 'type', selector: '#password', value: 'securePassword123' },
          { type: 'click', selector: '#login-button' },
          { type: 'wait', condition: 'element', value: '.dashboard' },
          { type: 'assert', selector: '.user-profile' }
        ]
      },
      {
        name: 'should show error for invalid credentials',
        actions: [
          { type: 'type', selector: '#email', value: 'invalid@example.com' },
          { type: 'type', selector: '#password', value: 'wrongpassword' },
          { type: 'click', selector: '#login-button' },
          { type: 'assert', selector: '.error-message' }
        ]
      }
    ]
  },
  outputPath: './tests/auth.test.js',
  validate: true,
  overwrite: false
});
```

### execute_test

Executes TestCafe tests with comprehensive configuration options.

#### Input Schema

```typescript
interface ExecuteTestInput {
  testPath?: string;
  testCode?: string;
  browsers?: string[];
  reporter?: ReporterType;
  screenshots?: boolean;
  screenshotPath?: string;
  video?: boolean;
  videoPath?: string;
  concurrency?: number;
  speed?: number;
  timeout?: number;
  quarantine?: boolean;
  skipJsErrors?: boolean;
  stopOnFirstFail?: boolean;
  filter?: TestFilter;
  clientScripts?: string[];
  compilerOptions?: CompilerOptions;
}

type ReporterType = 'spec' | 'json' | 'minimal' | 'xunit' | 'list' | 'tap';

interface TestFilter {
  test?: string;
  fixture?: string;
  testGrep?: string;
  fixtureGrep?: string;
  testMeta?: Record<string, any>;
  fixtureMeta?: Record<string, any>;
}

interface CompilerOptions {
  typescript?: {
    configPath?: string;
    customCompilerModulePath?: string;
  };
}
```

#### Response

```typescript
interface ExecuteTestResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}
```

#### Example

```javascript
const result = await mcpClient.callTool('execute_test', {
  testPath: './tests/auth.test.js',
  browsers: ['chrome:headless', 'firefox:headless'],
  reporter: 'spec',
  screenshots: true,
  screenshotPath: './test-screenshots',
  video: true,
  videoPath: './test-videos',
  concurrency: 2,
  speed: 1,
  timeout: 30000,
  quarantine: false,
  skipJsErrors: true,
  stopOnFirstFail: false,
  filter: {
    testGrep: 'should login.*valid'
  }
});
```

### validate_test

Validates TestCafe test code and structure for syntax, best practices, and potential issues.

#### Input Schema

```typescript
interface ValidateTestInput {
  source: TestSource;
  validationLevel?: ValidationLevel;
  checkBestPractices?: boolean;
  includeWarnings?: boolean;
  includeSuggestions?: boolean;
  customRules?: ValidationRule[];
}

interface TestSource {
  type: 'file' | 'code' | 'structure';
  path?: string;
  content?: string | TestStructure;
}

type ValidationLevel = 'basic' | 'comprehensive' | 'strict';

interface ValidationRule {
  name: string;
  severity: 'error' | 'warning' | 'info';
  pattern?: string;
  message: string;
}
```

#### Response

```typescript
interface ValidateTestResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}
```

#### Example

```javascript
const result = await mcpClient.callTool('validate_test', {
  source: {
    type: 'file',
    path: './tests/auth.test.js'
  },
  validationLevel: 'comprehensive',
  checkBestPractices: true,
  includeWarnings: true,
  includeSuggestions: true,
  customRules: [
    {
      name: 'no-hardcoded-urls',
      severity: 'warning',
      pattern: 'https?://[^"\']+',
      message: 'Consider using environment variables for URLs'
    }
  ]
});
```

### interact

Performs browser interactions with real-time execution and optional test generation.

#### Input Schema

```typescript
interface InteractInput {
  actions: BrowserAction[];
  generateTest?: boolean;
  testName?: string;
  fixtureName?: string;
  outputPath?: string;
  validate?: boolean;
  executeLive?: boolean;
  browser?: string;
  url?: string;
  timeout?: number;
  screenshots?: boolean;
  screenshotPath?: string;
}

interface BrowserAction {
  type: 'click' | 'type' | 'navigate' | 'wait' | 'assert' | 'hover' | 'scroll' | 'drag';
  selector?: string;
  text?: string;
  url?: string;
  condition?: WaitCondition;
  value?: string | number;
  timeout?: number;
  options?: ActionOptions;
}

type WaitCondition = 'timeout' | 'element' | 'function';

interface ActionOptions {
  modifiers?: KeyModifiers;
  offsetX?: number;
  offsetY?: number;
  replace?: boolean;
  paste?: boolean;
  confidential?: boolean;
}

interface KeyModifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}
```

#### Response

```typescript
interface InteractResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}
```

#### Example

```javascript
const result = await mcpClient.callTool('interact', {
  actions: [
    { type: 'navigate', url: 'https://example.com/search' },
    { type: 'type', selector: '#search-input', text: 'TestCafe automation' },
    { type: 'click', selector: '#search-button' },
    { type: 'wait', condition: 'element', value: '.search-results', timeout: 5000 },
    { type: 'hover', selector: '.search-result:first-child' },
    { type: 'click', selector: '.search-result:first-child a' },
    { type: 'assert', selector: 'h1' }
  ],
  executeLive: true,
  browser: 'chrome',
  screenshots: true,
  screenshotPath: './interaction-screenshots',
  generateTest: true,
  testName: 'Search and Navigate Test',
  fixtureName: 'Search Functionality',
  outputPath: './tests/search-interaction.test.js'
});
```

### inspect_page

Analyzes web pages, discovers elements, and generates selector suggestions.

#### Input Schema

```typescript
interface InspectPageInput {
  operation: InspectionOperation;
  target: InspectionTarget;
  options?: InspectionOptions;
  output?: OutputOptions;
  executeLive?: boolean;
  browser?: string;
  screenshots?: boolean;
  screenshotPath?: string;
}

type InspectionOperation = 'analyze' | 'discover' | 'suggest-selectors' | 'generate-code';

interface InspectionTarget {
  type: 'url' | 'current-page' | 'element' | 'element-info';
  url?: string;
  selector?: string;
  elementInfo?: ElementInfo;
}

interface InspectionOptions {
  includeHidden?: boolean;
  maxDepth?: number;
  includeText?: boolean;
  includeAttributes?: boolean;
  filterByTag?: string[];
  filterByClass?: string[];
  maxElements?: number;
}

interface OutputOptions {
  format?: 'json' | 'text' | 'code';
  saveToFile?: boolean;
  filePath?: string;
}

interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  attributes: Record<string, string>;
  boundingBox: BoundingBox;
  isVisible: boolean;
  isEnabled: boolean;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

#### Response

```typescript
interface InspectPageResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}
```

#### Example

```javascript
// Analyze page structure
const analysisResult = await mcpClient.callTool('inspect_page', {
  operation: 'analyze',
  target: {
    type: 'url',
    url: 'https://example.com/contact'
  },
  executeLive: true,
  browser: 'chrome:headless',
  screenshots: true,
  screenshotPath: './analysis-screenshots',
  options: {
    includeHidden: false,
    includeText: true,
    includeAttributes: true,
    filterByTag: ['form', 'input', 'button', 'select', 'textarea']
  },
  output: {
    format: 'json',
    saveToFile: true,
    filePath: './analysis-results.json'
  }
});

// Discover specific elements
const discoveryResult = await mcpClient.callTool('inspect_page', {
  operation: 'discover',
  target: {
    type: 'element',
    selector: 'form input, form select, form textarea'
  },
  executeLive: true,
  options: {
    maxElements: 20,
    includeAttributes: true
  }
});

// Get selector suggestions
const selectorResult = await mcpClient.callTool('inspect_page', {
  operation: 'suggest-selectors',
  target: {
    type: 'element-info',
    elementInfo: {
      tagName: 'BUTTON',
      id: 'submit-form',
      className: 'btn btn-primary btn-lg',
      text: 'Submit Application',
      attributes: {
        type: 'submit',
        class: 'btn btn-primary btn-lg',
        id: 'submit-form',
        'data-testid': 'submit-button'
      },
      boundingBox: { x: 100, y: 200, width: 150, height: 40 },
      isVisible: true,
      isEnabled: true
    }
  }
});
```

## Data Types

### Common Types

```typescript
// Test execution result
interface TestExecutionResult {
  success: boolean;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  duration: number;
  errors: TestError[];
  warnings: string[];
  screenshots?: string[];
  videos?: string[];
  reportPath?: string;
}

interface TestError {
  testName: string;
  error: string;
  stack?: string;
}

// Page structure analysis
interface PageStructureAnalysis {
  title: string;
  url: string;
  forms: FormInfo[];
  links: LinkInfo[];
  buttons: ButtonInfo[];
  inputs: InputInfo[];
  headings: HeadingInfo[];
}

interface FormInfo {
  id?: string;
  action?: string;
  method?: string;
  fields: FieldInfo[];
}

interface FieldInfo {
  name: string;
  type: string;
  required: boolean;
  selector: string;
}

interface LinkInfo {
  text: string;
  href: string;
  selector: string;
}

interface ButtonInfo {
  text: string;
  type: string;
  selector: string;
}

interface InputInfo {
  name?: string;
  type: string;
  placeholder?: string;
  selector: string;
}

interface HeadingInfo {
  level: number;
  text: string;
  selector: string;
}

// Selector suggestions
interface SelectorSuggestion {
  selector: string;
  type: 'id' | 'class' | 'attribute' | 'text' | 'css' | 'xpath';
  specificity: number;
  description: string;
}
```

## Examples

### Complete E2E Testing Workflow

```javascript
class E2ETestingWorkflow {
  constructor(mcpClient) {
    this.client = mcpClient;
  }

  async createCompleteTestSuite() {
    // 1. Analyze the application
    const pageAnalysis = await this.client.callTool('inspect_page', {
      operation: 'analyze',
      target: { type: 'url', url: 'https://app.example.com' },
      executeLive: true,
      browser: 'chrome:headless',
      screenshots: true,
      options: {
        includeHidden: false,
        includeText: true,
        includeAttributes: true
      }
    });

    // 2. Create authentication tests
    const authTests = await this.client.callTool('create_test', {
      testStructure: {
        fixture: 'Authentication',
        url: 'https://app.example.com/login',
        beforeEach: [
          { type: 'navigate', value: 'https://app.example.com/login' }
        ],
        tests: [
          {
            name: 'should login successfully with valid credentials',
            actions: [
              { type: 'type', selector: '#email', value: 'test@example.com' },
              { type: 'type', selector: '#password', value: 'password123' },
              { type: 'click', selector: '#login-btn' },
              { type: 'wait', condition: 'element', value: '.dashboard', timeout: 5000 },
              { type: 'assert', selector: '.dashboard' }
            ]
          },
          {
            name: 'should show error for invalid credentials',
            actions: [
              { type: 'type', selector: '#email', value: 'invalid@example.com' },
              { type: 'type', selector: '#password', value: 'wrongpassword' },
              { type: 'click', selector: '#login-btn' },
              { type: 'wait', condition: 'element', value: '.error-message', timeout: 3000 },
              { type: 'assert', selector: '.error-message' }
            ]
          }
        ]
      },
      outputPath: './tests/auth.test.js',
      validate: true
    });

    // 3. Create navigation tests
    const navTests = await this.client.callTool('create_test', {
      testStructure: {
        fixture: 'Navigation',
        url: 'https://app.example.com/dashboard',
        tests: [
          {
            name: 'should navigate to profile page',
            actions: [
              { type: 'click', selector: '#profile-link' },
              { type: 'wait', condition: 'element', value: '.profile-page' },
              { type: 'assert', selector: '.profile-page' }
            ]
          },
          {
            name: 'should navigate to settings page',
            actions: [
              { type: 'click', selector: '#settings-link' },
              { type: 'wait', condition: 'element', value: '.settings-page' },
              { type: 'assert', selector: '.settings-page' }
            ]
          }
        ]
      },
      outputPath: './tests/navigation.test.js',
      validate: true
    });

    // 4. Validate all created tests
    const validationResults = await Promise.all([
      this.client.callTool('validate_test', {
        source: { type: 'file', path: './tests/auth.test.js' },
        validationLevel: 'comprehensive',
        checkBestPractices: true
      }),
      this.client.callTool('validate_test', {
        source: { type: 'file', path: './tests/navigation.test.js' },
        validationLevel: 'comprehensive',
        checkBestPractices: true
      })
    ]);

    // 5. Execute all tests with comprehensive reporting
    const executionResult = await this.client.callTool('execute_test', {
      testPath: './tests/*.test.js',
      browsers: ['chrome:headless', 'firefox:headless'],
      screenshots: true,
      screenshotPath: './test-screenshots',
      video: true,
      videoPath: './test-videos',
      reporter: 'spec',
      concurrency: 2,
      speed: 1,
      timeout: 30000,
      quarantine: false,
      stopOnFirstFail: false
    });

    return {
      pageAnalysis,
      authTests,
      navTests,
      validationResults,
      executionResult
    };
  }
}
```

### Advanced Form Testing

```javascript
class FormTestingWorkflow {
  constructor(mcpClient) {
    this.client = mcpClient;
  }

  async createFormTests(formUrl) {
    // 1. Analyze form structure
    const formAnalysis = await this.client.callTool('inspect_page', {
      operation: 'analyze',
      target: { type: 'url', url: formUrl },
      executeLive: true,
      browser: 'chrome:headless',
      options: {
        filterByTag: ['form', 'input', 'select', 'textarea', 'button'],
        includeAttributes: true
      }
    });

    // 2. Create comprehensive form tests
    const formTests = await this.client.callTool('create_test', {
      testStructure: {
        fixture: 'Contact Form Validation',
        url: formUrl,
        tests: [
          {
            name: 'should validate required fields',
            actions: [
              { type: 'click', selector: '#submit-button' },
              { type: 'assert', selector: '.error-name' },
              { type: 'assert', selector: '.error-email' },
              { type: 'assert', selector: '.error-message' }
            ]
          },
          {
            name: 'should validate email format',
            actions: [
              { type: 'type', selector: '#name', value: 'John Doe' },
              { type: 'type', selector: '#email', value: 'invalid-email' },
              { type: 'type', selector: '#message', value: 'Test message' },
              { type: 'click', selector: '#submit-button' },
              { type: 'assert', selector: '.error-email-format' }
            ]
          },
          {
            name: 'should submit form with valid data',
            actions: [
              { type: 'type', selector: '#name', value: 'John Doe' },
              { type: 'type', selector: '#email', value: 'john@example.com' },
              { type: 'type', selector: '#phone', value: '+1-555-123-4567' },
              { type: 'type', selector: '#message', value: 'This is a test message from automated testing.' },
              { type: 'click', selector: '#submit-button' },
              { type: 'wait', condition: 'element', value: '.success-message', timeout: 10000 },
              { type: 'assert', selector: '.success-message' }
            ]
          },
          {
            name: 'should handle form reset functionality',
            actions: [
              { type: 'type', selector: '#name', value: 'Test User' },
              { type: 'type', selector: '#email', value: 'test@example.com' },
              { type: 'click', selector: '#reset-button' },
              { type: 'assert', selector: '#name[value=""]' },
              { type: 'assert', selector: '#email[value=""]' }
            ]
          }
        ]
      },
      outputPath: './tests/form-validation.test.js',
      validate: true
    });

    // 3. Test with live interaction to verify behavior
    const liveTest = await this.client.callTool('interact', {
      actions: [
        { type: 'navigate', url: formUrl },
        { type: 'type', selector: '#name', text: 'Live Test User' },
        { type: 'type', selector: '#email', text: 'livetest@example.com' },
        { type: 'type', selector: '#message', text: 'Testing form interaction' },
        { type: 'click', selector: '#submit-button' }
      ],
      executeLive: true,
      browser: 'chrome',
      screenshots: true,
      screenshotPath: './form-interaction-screenshots',
      generateTest: false
    });

    return { formAnalysis, formTests, liveTest };
  }
}
```

### E-commerce Testing Suite

```javascript
class EcommerceTestingSuite {
  constructor(mcpClient) {
    this.client = mcpClient;
  }

  async createShoppingFlowTests(baseUrl) {
    // 1. Product search and filtering
    const searchTests = await this.client.callTool('create_test', {
      testStructure: {
        fixture: 'Product Search and Filtering',
        url: `${baseUrl}/products`,
        tests: [
          {
            name: 'should search for products by keyword',
            actions: [
              { type: 'type', selector: '#search-input', value: 'laptop' },
              { type: 'click', selector: '#search-button' },
              { type: 'wait', condition: 'element', value: '.search-results' },
              { type: 'assert', selector: '.product-item' }
            ]
          },
          {
            name: 'should filter products by category',
            actions: [
              { type: 'click', selector: '#category-electronics' },
              { type: 'wait', condition: 'element', value: '.filtered-results' },
              { type: 'assert', selector: '.product-item[data-category="electronics"]' }
            ]
          },
          {
            name: 'should sort products by price',
            actions: [
              { type: 'click', selector: '#sort-price-low-high' },
              { type: 'wait', condition: 'timeout', value: 2000 },
              { type: 'assert', selector: '.product-item:first-child .price' }
            ]
          }
        ]
      },
      outputPath: './tests/product-search.test.js'
    });

    // 2. Shopping cart functionality
    const cartTests = await this.client.callTool('create_test', {
      testStructure: {
        fixture: 'Shopping Cart Management',
        url: `${baseUrl}/products`,
        tests: [
          {
            name: 'should add product to cart',
            actions: [
              { type: 'click', selector: '.product-item:first-child' },
              { type: 'wait', condition: 'element', value: '.product-details' },
              { type: 'click', selector: '#add-to-cart' },
              { type: 'wait', condition: 'element', value: '.cart-notification' },
              { type: 'assert', selector: '.cart-count[data-count="1"]' }
            ]
          },
          {
            name: 'should update cart quantity',
            actions: [
              { type: 'click', selector: '#cart-icon' },
              { type: 'wait', condition: 'element', value: '.cart-items' },
              { type: 'click', selector: '.quantity-increase' },
              { type: 'wait', condition: 'timeout', value: 1000 },
              { type: 'assert', selector: '.quantity-input[value="2"]' }
            ]
          },
          {
            name: 'should remove item from cart',
            actions: [
              { type: 'click', selector: '#cart-icon' },
              { type: 'wait', condition: 'element', value: '.cart-items' },
              { type: 'click', selector: '.remove-item' },
              { type: 'wait', condition: 'element', value: '.empty-cart-message' },
              { type: 'assert', selector: '.cart-count[data-count="0"]' }
            ]
          }
        ]
      },
      outputPath: './tests/shopping-cart.test.js'
    });

    // 3. Checkout process
    const checkoutTests = await this.client.callTool('create_test', {
      testStructure: {
        fixture: 'Checkout Process',
        url: `${baseUrl}/checkout`,
        beforeEach: [
          { type: 'navigate', value: `${baseUrl}/products` },
          { type: 'click', selector: '.product-item:first-child' },
          { type: 'click', selector: '#add-to-cart' },
          { type: 'click', selector: '#cart-icon' },
          { type: 'click', selector: '#checkout-button' }
        ],
        tests: [
          {
            name: 'should complete checkout with valid information',
            actions: [
              { type: 'type', selector: '#billing-name', value: 'John Doe' },
              { type: 'type', selector: '#billing-email', value: 'john@example.com' },
              { type: 'type', selector: '#billing-address', value: '123 Main St' },
              { type: 'type', selector: '#billing-city', value: 'Anytown' },
              { type: 'type', selector: '#billing-zip', value: '12345' },
              { type: 'type', selector: '#card-number', value: '4111111111111111' },
              { type: 'type', selector: '#card-expiry', value: '12/25' },
              { type: 'type', selector: '#card-cvc', value: '123' },
              { type: 'click', selector: '#place-order' },
              { type: 'wait', condition: 'element', value: '.order-confirmation', timeout: 10000 },
              { type: 'assert', selector: '.order-number' }
            ]
          },
          {
            name: 'should validate required checkout fields',
            actions: [
              { type: 'click', selector: '#place-order' },
              { type: 'assert', selector: '.error-billing-name' },
              { type: 'assert', selector: '.error-billing-email' },
              { type: 'assert', selector: '.error-card-number' }
            ]
          }
        ]
      },
      outputPath: './tests/checkout-process.test.js'
    });

    // 4. Execute comprehensive test suite
    const executionResult = await this.client.callTool('execute_test', {
      testPath: './tests/{product-search,shopping-cart,checkout-process}.test.js',
      browsers: ['chrome:headless'],
      screenshots: true,
      screenshotPath: './ecommerce-screenshots',
      video: true,
      videoPath: './ecommerce-videos',
      reporter: 'spec',
      concurrency: 1, // Sequential for e-commerce flow
      speed: 0.8, // Slightly slower for reliability
      timeout: 45000 // Longer timeout for checkout
    });

    return { searchTests, cartTests, checkoutTests, executionResult };
  }
}
```

### Interactive Test Development

```javascript
class InteractiveTestDevelopment {
  constructor(mcpClient) {
    this.client = mcpClient;
  }

  async developTestInteractively() {
    // 1. Explore the application interactively
    const exploration = await this.client.callTool('interact', {
      actions: [
        { type: 'navigate', url: 'https://app.example.com' },
        { type: 'click', selector: '#explore-features' },
        { type: 'wait', condition: 'element', value: '.features-list' }
      ],
      executeLive: true,
      browser: 'chrome',
      screenshots: true
    });

    // 2. Discover elements for testing
    const elementDiscovery = await this.client.callTool('inspect_page', {
      operation: 'discover',
      target: { type: 'current-page' },
      executeLive: true,
      options: { includeHidden: false }
    });

    // 3. Generate test based on exploration
    const testGeneration = await this.client.callTool('interact', {
      actions: [
        { type: 'click', selector: '.feature-item:first-child' },
        { type: 'assert', selector: '.feature-details' }
      ],
      generateTest: true,
      testName: 'Feature Exploration Test',
      outputPath: './tests/feature-exploration.test.js'
    });

    // 4. Validate the generated test
    const validation = await this.client.callTool('validate_test', {
      source: {
        type: 'file',
        path: './tests/feature-exploration.test.js'
      },
      validationLevel: 'comprehensive'
    });

    return {
      exploration,
      elementDiscovery,
      testGeneration,
      validation
    };
  }
}
```

## Best Practices

### Error Handling

Always wrap MCP tool calls in try-catch blocks:

```javascript
try {
  const result = await mcpClient.callTool('execute_test', params);
  // Handle success
} catch (error) {
  if (error.code === 'InvalidParams') {
    // Handle parameter validation errors
  } else if (error.code === 'InternalError') {
    // Handle execution errors
  }
  // Handle other errors
}
```

### Performance Optimization

1. Use headless browsers for faster execution
2. Limit concurrency based on system resources
3. Use selective test execution with filters
4. Enable screenshot/video only when needed

### Test Maintenance

1. Use page object patterns for complex applications
2. Validate tests regularly with comprehensive validation
3. Keep selectors robust using ID and data attributes
4. Use environment-specific configurations

## Troubleshooting

### Common Issues

1. **Browser Launch Failures**: Ensure proper browser installation and permissions
2. **Selector Not Found**: Use inspect_page to verify element existence
3. **Timeout Errors**: Increase timeout values or add explicit waits
4. **Memory Issues**: Reduce concurrency or enable resource cleanup

### Debug Mode

Enable debug mode for detailed logging:

```javascript
const result = await mcpClient.callTool('execute_test', {
  // ... other params
  debug: true,
  verbose: true
});
```

For more troubleshooting information, see the main README.md file.