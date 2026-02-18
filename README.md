# TestCafe MCP Server

![GitHub stars](https://img.shields.io/github/stars/rkdfx/testcafe-mcp?style=flat-square&logo=github)
![CI](https://github.com/rkdfx/testcafe-mcp/workflows/CI/badge.svg)
![Visitors](https://api.visitorbadge.io/api/visitors?path=rkdfx%2Ftestcafe-mcp&label=Visitors&countColor=%23263759&style=flat)

A comprehensive Model Context Protocol (MCP) server that bridges AI assistants with TestCafe testing capabilities, enabling AI-driven browser automation and test creation. Provides 17 MCP tools including agentic browser control with the snapshot → ref → act pattern.

## 🚀 Features

### Core Capabilities
- **Test Creation**: Generate TestCafe tests from structured input or natural language descriptions
- **Test Execution**: Run tests with real browser automation and comprehensive reporting
- **Test Validation**: Validate test code syntax, structure, and best practices
- **Browser Interaction**: Perform real-time browser interactions with live feedback
- **Page Inspection**: Analyze web pages, discover elements, and suggest optimal selectors

### Agentic Browser Control
- **Persistent Browser Session**: One headless browser stays open across tool calls — no re-launching per action
- **Snapshot → Ref → Act Pattern**: Get an accessibility tree with element refs, then click/type/interact by ref
- **7 Granular Tools**: `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_press_key`, `browser_evaluate`, `browser_take_screenshot`

### Advanced Features
- **Real Browser Integration**: Execute actions in actual browser instances
- **Screenshot & Video Recording**: Capture test execution with visual artifacts
- **Live Element Discovery**: Inspect pages in real-time to find interactive elements
- **Intelligent Selector Suggestions**: AI-powered selector recommendations
- **Comprehensive Error Reporting**: Detailed error analysis and troubleshooting

## 📦 Installation

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn package manager

### Quick Start
```bash
# Clone and install
git clone <repository-url>
cd testcafe-mcp-server
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Development Setup
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Lint code
npm run lint
npm run lint:fix
```

## 🔧 Configuration

### MCP Client Configuration

#### Claude Desktop Configuration
Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "testcafe": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/path/to/testcafe-mcp-server"
    }
  }
}
```

#### Continue.dev Configuration
Add to your Continue configuration (`.continue/config.json`):

```json
{
  "mcpServers": [
    {
      "name": "testcafe",
      "serverPath": "/path/to/testcafe-mcp-server/dist/index.js"
    }
  ]
}
```

#### Generic MCP Client Configuration
For other MCP clients, use the standard MCP server configuration format:

```json
{
  "servers": {
    "testcafe": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/path/to/testcafe-mcp-server",
      "env": {
        "NODE_ENV": "production",
        "DEBUG": "testcafe:*"
      }
    }
  }
}
```

### Server Configuration

The server accepts configuration through environment variables or a config file:

```javascript
// config.json
{
  "server": {
    "name": "testcafe-mcp-server",
    "version": "1.0.0",
    "debug": false
  },
  "testcafe": {
    "browsers": [
      {
        "name": "chrome",
        "headless": true,
        "args": ["--no-sandbox", "--disable-dev-shm-usage"]
      }
    ],
    "timeout": 30000,
    "speed": 1,
    "concurrency": 1,
    "quarantineMode": false,
    "skipJsErrors": true,
    "skipUncaughtErrors": true,
    "stopOnFirstFail": false
  }
}
```

## 🛠 MCP Tools

### 1. create_test
Create TestCafe test files from structured input.

**Input Schema:**
```typescript
{
  testStructure: {
    fixture: string;
    url?: string;
    tests: Array<{
      name: string;
      actions: Array<{
        type: 'navigate' | 'click' | 'type' | 'wait' | 'assert';
        selector?: string;
        value?: string;
        timeout?: number;
      }>;
    }>;
  };
  outputPath?: string;
  validate?: boolean;
}
```

**Example Usage:**
```javascript
// Create a login test
{
  "testStructure": {
    "fixture": "User Login",
    "url": "https://example.com/login",
    "tests": [{
      "name": "should login successfully",
      "actions": [
        { "type": "type", "selector": "#username", "value": "testuser" },
        { "type": "type", "selector": "#password", "value": "password123" },
        { "type": "click", "selector": "#login-btn" },
        { "type": "assert", "selector": ".welcome-message" }
      ]
    }]
  },
  "outputPath": "./tests/login.test.js",
  "validate": true
}
```

### 2. execute_test
Execute TestCafe tests with comprehensive options.

**Input Schema:**
```typescript
{
  testPath?: string;
  testCode?: string;
  browsers?: string[];
  reporter?: 'spec' | 'json' | 'minimal' | 'xunit' | 'list';
  screenshots?: boolean;
  screenshotPath?: string;
  video?: boolean;
  videoPath?: string;
  concurrency?: number;
  speed?: number;
  timeout?: number;
  quarantine?: boolean;
  stopOnFirstFail?: boolean;
  filter?: {
    test?: string;
    fixture?: string;
    testGrep?: string;
    fixtureGrep?: string;
  };
}
```

**Example Usage:**
```javascript
// Execute test with screenshots
{
  "testPath": "./tests/login.test.js",
  "browsers": ["chrome:headless", "firefox:headless"],
  "screenshots": true,
  "screenshotPath": "./screenshots",
  "reporter": "spec",
  "concurrency": 2
}
```

### 3. validate_test
Validate TestCafe test code and structure.

**Input Schema:**
```typescript
{
  source: {
    type: 'file' | 'code' | 'structure';
    content: string | TestStructure;
  };
  validationLevel?: 'basic' | 'comprehensive' | 'strict';
  checkBestPractices?: boolean;
}
```

### 4. interact
Perform browser interactions with real-time execution.

**Input Schema:**
```typescript
{
  actions: Array<{
    type: 'click' | 'type' | 'navigate' | 'wait' | 'assert';
    selector?: string;
    text?: string;
    url?: string;
    // ... action-specific options
  }>;
  generateTest?: boolean;
  executeLive?: boolean;
  browser?: string;
  url?: string;
  screenshots?: boolean;
}
```

**Example Usage:**
```javascript
// Perform live browser interactions
{
  "actions": [
    { "type": "navigate", "url": "https://example.com" },
    { "type": "click", "selector": "#menu-button" },
    { "type": "type", "selector": "#search-input", "text": "TestCafe" },
    { "type": "click", "selector": "#search-submit" }
  ],
  "executeLive": true,
  "browser": "chrome",
  "screenshots": true,
  "generateTest": true,
  "outputPath": "./generated-test.js"
}
```

### 5. inspect_page
Analyze web pages and discover elements.

**Input Schema:**
```typescript
{
  operation: 'analyze' | 'discover' | 'suggest-selectors' | 'generate-code';
  target: {
    type: 'url' | 'current-page' | 'element' | 'element-info';
    url?: string;
    selector?: string;
    elementInfo?: ElementInfo;
  };
  options?: {
    includeHidden?: boolean;
    includeText?: boolean;
    includeAttributes?: boolean;
  };
  executeLive?: boolean;
  browser?: string;
  screenshots?: boolean;
}
```

### 6–10. Utility Tools

| Tool | Description |
|------|-------------|
| `get_console_logs` | Capture browser console logs (errors, warnings, info, debug) |
| `get_accessibility_snapshot` | Return the accessibility tree of a web page |
| `browser_tabs` | List, create, close, or switch browser tabs |
| `get_network_logs` | Capture network requests and responses for debugging |
| `handle_dialogs` | Capture and handle native browser dialogs (alert, confirm, prompt) |

---

### Agentic Browser Control (11–17)

These tools provide a **persistent browser session** with the **snapshot → ref → act** pattern — the same approach used by Playwright MCP. One headless browser stays open across all tool calls, enabling multi-step agentic workflows.

**How it works:**
1. **`browser_navigate`** — open a URL in the persistent browser
2. **`browser_snapshot`** — get an accessibility tree with `ref` IDs on interactive elements
3. **`browser_click` / `browser_type` / `browser_press_key`** — act on elements using their `ref`
4. **`browser_evaluate`** — run arbitrary JavaScript in the browser
5. **`browser_take_screenshot`** — capture a PNG/JPEG screenshot

#### browser_navigate
Navigate to a URL in the persistent browser session.
```json
{ "url": "https://example.com" }
```

#### browser_snapshot
Capture an accessibility snapshot of the current page. Returns a formatted text tree with `ref` IDs on interactive elements. Use these refs with other `browser_*` tools.
```json
{}
```

**Example output:**
```
Page: Example (https://example.com)

- banner
  - navigation "Main"
    - link "Home" [ref=e1]
    - link "About" [ref=e2]
- main
  - heading "Welcome" [level=1] [ref=e3]
  - searchbox "Search" [ref=e4]
  - button "Go" [ref=e5]
```

#### browser_click
Click an element by its snapshot ref.
```json
{ "ref": "e5", "element": "Go button" }
```

#### browser_type
Type text into an element by its snapshot ref.
```json
{ "ref": "e4", "text": "search query", "submit": true }
```

#### browser_press_key
Press a keyboard key (e.g. `enter`, `tab`, `escape`, `backspace`).
```json
{ "key": "enter" }
```

#### browser_evaluate
Evaluate a JavaScript expression in the browser context.
```json
{ "function": "document.title" }
```

#### browser_take_screenshot
Take a screenshot of the current page. Returns the image as base64.
```json
{ "type": "png", "fullPage": false }
```

#### Agentic Workflow Example

```javascript
// Step 1: Navigate
await mcpClient.callTool('browser_navigate', { url: 'https://en.wikipedia.org' });

// Step 2: Get page snapshot with element refs
const snapshot = await mcpClient.callTool('browser_snapshot', {});
// Returns tree with refs like: searchbox "Search Wikipedia" [ref=e5]

// Step 3: Type into the search box using its ref
await mcpClient.callTool('browser_type', {
  ref: 'e5', text: 'TestCafe', submit: true
});

// Step 4: Take a new snapshot of the results page
const results = await mcpClient.callTool('browser_snapshot', {});

// Step 5: Click a result link
await mcpClient.callTool('browser_click', { ref: 'e12' });

// Step 6: Get the page title
const title = await mcpClient.callTool('browser_evaluate', {
  function: 'document.title'
});
```

## 📚 Examples

### Quick Start Examples

#### 1. AI-Assisted Test Creation
```javascript
// Ask AI: "Create a test for the login form on example.com"
// The AI will use these MCP tools automatically:

// Step 1: Inspect the page structure
const pageAnalysis = await mcpClient.callTool('inspect_page', {
  operation: 'analyze',
  target: { type: 'url', url: 'https://example.com/login' },
  executeLive: true,
  browser: 'chrome:headless'
});

// Step 2: Create test based on discovered elements
const testResult = await mcpClient.callTool('create_test', {
  testStructure: {
    fixture: 'Login Flow Tests',
    url: 'https://example.com/login',
    tests: [{
      name: 'should login with valid credentials',
      actions: [
        { type: 'type', selector: '#username', value: 'testuser' },
        { type: 'type', selector: '#password', value: 'password123' },
        { type: 'click', selector: '#login-button' },
        { type: 'wait', condition: 'element', value: '.dashboard' },
        { type: 'assert', selector: '.welcome-message' }
      ]
    }]
  },
  outputPath: './tests/login.test.js',
  validate: true
});

// Step 3: Execute the test with comprehensive reporting
const executionResult = await mcpClient.callTool('execute_test', {
  testPath: './tests/login.test.js',
  browsers: ['chrome:headless', 'firefox:headless'],
  screenshots: true,
  screenshotPath: './test-screenshots',
  video: true,
  videoPath: './test-videos',
  reporter: 'spec'
});
```

#### 2. Interactive Test Development
```javascript
// Ask AI: "Help me explore this website and create tests interactively"

// Live browser interaction with test generation
const interactionResult = await mcpClient.callTool('interact', {
  actions: [
    { type: 'navigate', url: 'https://example.com/shop' },
    { type: 'type', selector: '#search', text: 'laptop' },
    { type: 'click', selector: '#search-btn' },
    { type: 'wait', condition: 'element', value: '.search-results' },
    { type: 'click', selector: '.product:first-child' },
    { type: 'click', selector: '#add-to-cart' },
    { type: 'assert', selector: '.cart-notification' }
  ],
  executeLive: true,
  browser: 'chrome',
  screenshots: true,
  generateTest: true,
  testName: 'Product Search and Add to Cart',
  outputPath: './tests/shopping.test.js'
});
```

#### 3. Page Analysis and Element Discovery
```javascript
// Ask AI: "Analyze this page and suggest the best selectors for testing"

// Comprehensive page analysis
const pageAnalysis = await mcpClient.callTool('inspect_page', {
  operation: 'analyze',
  target: { type: 'url', url: 'https://example.com/form' },
  executeLive: true,
  options: {
    includeHidden: false,
    includeText: true,
    includeAttributes: true,
    filterByTag: ['form', 'input', 'button', 'select']
  }
});

// Get selector suggestions for specific elements
const selectorSuggestions = await mcpClient.callTool('inspect_page', {
  operation: 'suggest-selectors',
  target: {
    type: 'element-info',
    elementInfo: {
      tagName: 'BUTTON',
      id: 'submit-btn',
      className: 'btn btn-primary',
      text: 'Submit Form',
      attributes: { 'data-testid': 'submit-button' }
    }
  }
});
```

### Real-World Use Cases

#### E-commerce Testing Suite
```javascript
// Complete e-commerce testing workflow
const ecommerceTests = await mcpClient.callTool('create_test', {
  testStructure: {
    fixture: 'E-commerce User Journey',
    url: 'https://shop.example.com',
    beforeEach: [
      { type: 'navigate', value: 'https://shop.example.com' }
    ],
    tests: [
      {
        name: 'User can search and filter products',
        actions: [
          { type: 'type', selector: '#search-input', value: 'wireless headphones' },
          { type: 'click', selector: '#search-button' },
          { type: 'wait', condition: 'element', value: '.search-results' },
          { type: 'click', selector: '#filter-brand-sony' },
          { type: 'wait', condition: 'element', value: '.filtered-results' },
          { type: 'assert', selector: '.product-count' }
        ]
      },
      {
        name: 'User can add product to cart and checkout',
        actions: [
          { type: 'click', selector: '.product-item:first-child' },
          { type: 'wait', condition: 'element', value: '.product-details' },
          { type: 'click', selector: '#add-to-cart' },
          { type: 'wait', condition: 'element', value: '.cart-notification' },
          { type: 'click', selector: '#cart-icon' },
          { type: 'click', selector: '#checkout-button' },
          { type: 'assert', selector: '.checkout-form' }
        ]
      }
    ]
  },
  outputPath: './tests/ecommerce-journey.test.js'
});
```

#### Form Validation Testing
```javascript
// Comprehensive form testing
const formTests = await mcpClient.callTool('create_test', {
  testStructure: {
    fixture: 'Contact Form Validation',
    url: 'https://example.com/contact',
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
          { type: 'type', selector: '#email', value: 'invalid-email' },
          { type: 'click', selector: '#submit-button' },
          { type: 'assert', selector: '.error-email-format' }
        ]
      },
      {
        name: 'should submit valid form successfully',
        actions: [
          { type: 'type', selector: '#name', value: 'John Doe' },
          { type: 'type', selector: '#email', value: 'john@example.com' },
          { type: 'type', selector: '#message', value: 'Test message' },
          { type: 'click', selector: '#submit-button' },
          { type: 'wait', condition: 'element', value: '.success-message' },
          { type: 'assert', selector: '.success-message' }
        ]
      }
    ]
  },
  outputPath: './tests/form-validation.test.js'
});
```

### Interactive Browser Session

```javascript
// Start an interactive session
const interactionResult = await mcpClient.callTool('interact', {
  actions: [
    { type: 'navigate', url: 'https://example.com' },
    { type: 'click', selector: '#explore-button' },
    { type: 'wait', condition: 'element', value: '.content-loaded' }
  ],
  executeLive: true,
  browser: 'chrome',
  screenshots: true,
  generateTest: true,
  outputPath: './exploration-test.js'
});
```

### Element Discovery and Selector Optimization

```javascript
// Discover elements on a page
const discoveryResult = await mcpClient.callTool('inspect_page', {
  operation: 'discover',
  target: { type: 'url', url: 'https://example.com/form' },
  executeLive: true,
  options: { includeHidden: false }
});

// Get selector suggestions for a specific element
const selectorResult = await mcpClient.callTool('inspect_page', {
  operation: 'suggest-selectors',
  target: {
    type: 'element-info',
    elementInfo: {
      tagName: 'BUTTON',
      id: 'submit-btn',
      className: 'btn btn-primary',
      text: 'Submit Form',
      attributes: { type: 'submit', class: 'btn btn-primary' },
      // ... other properties
    }
  }
});
```

## 🔍 Troubleshooting

### Common Issues

#### Browser Launch Failures
```bash
# Install required dependencies for headless Chrome
sudo apt-get update
sudo apt-get install -y chromium-browser

# For Docker environments
docker run --cap-add=SYS_ADMIN --shm-size=2g your-image
```

#### Permission Errors
```bash
# Ensure proper permissions for screenshot/video directories
mkdir -p ./screenshots ./videos
chmod 755 ./screenshots ./videos
```

#### Memory Issues
```javascript
// Reduce concurrency for resource-constrained environments
{
  "concurrency": 1,
  "speed": 0.5,
  "timeout": 60000
}
```

### Debug Mode

Enable debug logging:
```bash
DEBUG=testcafe:* npm start
```

Or set in configuration:
```javascript
{
  "server": { "debug": true },
  "testcafe": { "debugMode": true }
}
```

### Performance Optimization

#### Browser Reuse
```javascript
// Configure browser instance pooling
{
  "testcafe": {
    "concurrency": 3,
    "reuseInstances": true,
    "instanceTimeout": 300000
  }
}
```

#### Resource Management
```javascript
// Optimize for CI/CD environments
{
  "testcafe": {
    "browsers": [{ 
      "name": "chrome", 
      "headless": true,
      "args": [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--memory-pressure-off"
      ]
    }],
    "speed": 1,
    "timeout": 30000,
    "skipJsErrors": true
  }
}
```

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Real Browser Tests
```bash
npm run test:real
```

## 📈 Performance Monitoring

The server includes built-in performance monitoring:

- Test execution times
- Browser launch metrics
- Memory usage tracking
- Error rate monitoring

Access metrics through the debug interface or logs.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Guidelines

- Follow TypeScript strict mode
- Maintain test coverage above 80%
- Use ESLint configuration
- Document all public APIs
- Include examples for new features

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Related Projects

- [TestCafe](https://testcafe.io/) - End-to-end testing framework
- [Model Context Protocol](https://modelcontextprotocol.io/) - Protocol for AI tool integration

## 📚 Documentation

### Core Documentation
- **[API Reference](docs/API.md)** - Detailed API documentation with examples

### Integration Guides
- **[Claude Desktop Integration](examples/claude-desktop-integration.md)** - Configuration for Claude Desktop
- **[Continue.dev Integration](examples/continue-dev-integration.md)** - VS Code integration with Continue.dev

### Examples and Patterns
- **[Basic Examples](examples/)** - Simple usage examples and getting started
- **[Advanced Testing Patterns](examples/advanced-testing-patterns.js)** - Sophisticated testing workflows
- **[MCP Integration Example](examples/mcp-integration-example.js)** - Complete MCP client implementation

### Quick Links
- [API Tools](docs/API.md#tools) - Available MCP tools reference
- [Configuration](#mcp-client-configuration) - Configure your MCP client
- [Examples](#examples) - Usage examples and patterns

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/your-username/testcafe-mcp.git
cd testcafe-mcp-server

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

### Contribution Guidelines
1. **Fork the repository** and create a feature branch
2. **Write tests** for new functionality (maintain >80% coverage)
3. **Follow code style** - use ESLint configuration
4. **Update documentation** for API changes
5. **Test thoroughly** across different platforms
6. **Submit a pull request** with clear description

### Development Guidelines
- Follow TypeScript strict mode
- Use ESLint and Prettier for code formatting
- Write comprehensive tests for all new features
- Document all public APIs with JSDoc
- Include examples for new functionality
- Ensure cross-platform compatibility

### Reporting Issues
When reporting bugs, please include:
- Operating system and version
- Node.js version
- Browser versions
- Complete error messages
- Steps to reproduce
- Expected vs actual behavior

