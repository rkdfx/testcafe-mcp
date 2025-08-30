# Claude Desktop Integration Example

This guide shows how to integrate the TestCafe MCP Server with Claude Desktop for AI-assisted test automation.

## Setup

### 1. Install TestCafe MCP Server

```bash
git clone <repository-url>
cd testcafe-mcp-server
npm install
npm run build
```

### 2. Configure Claude Desktop

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "testcafe": {
      "command": "node",
      "args": ["/absolute/path/to/testcafe-mcp-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

After updating the configuration, restart Claude Desktop to load the MCP server.

## Usage Examples

### Example 1: Create Tests from Natural Language

**Prompt to Claude:**
```
I need to create automated tests for a login form at https://example.com/login. The form has username and password fields, and a submit button. Create comprehensive tests including validation scenarios.
```

**Claude will use the MCP tools to:**
1. Inspect the page structure
2. Create test files with proper TestCafe syntax
3. Include validation for both success and error cases
4. Generate executable test code

### Example 2: Analyze Existing Website

**Prompt to Claude:**
```
Please analyze the structure of https://example.com/contact-form and suggest the best testing strategy. I want to understand what elements are available and how to test the form submission flow.
```

**Claude will:**
1. Use `inspect_page` to analyze the page
2. Identify all form elements and interactive components
3. Suggest optimal selectors for reliable testing
4. Recommend test scenarios based on the discovered elements

### Example 3: Interactive Test Development

**Prompt to Claude:**
```
Help me create tests for an e-commerce site. I want to test the product search, filtering, and add-to-cart functionality. Let's do this step by step with live browser interaction.
```

**Claude will:**
1. Use live browser interaction to explore the site
2. Generate tests based on the actual user journey
3. Create comprehensive test suites covering the entire flow
4. Provide screenshots and videos of the test execution

### Example 4: Test Validation and Optimization

**Prompt to Claude:**
```
I have an existing TestCafe test file. Please validate it, check for best practices, and suggest improvements for better reliability and maintainability.
```

**Claude will:**
1. Validate the test syntax and structure
2. Check for TestCafe best practices
3. Suggest more robust selectors
4. Recommend improvements for test reliability

## Advanced Usage Patterns

### Continuous Integration Setup

**Prompt to Claude:**
```
Help me set up these tests to run in GitHub Actions CI/CD pipeline with proper browser configuration and artifact collection.
```

### Cross-Browser Testing

**Prompt to Claude:**
```
Modify these tests to run across multiple browsers (Chrome, Firefox, Safari) and generate comprehensive reports with screenshots for each browser.
```

### Performance Testing Integration

**Prompt to Claude:**
```
Add performance monitoring to these tests. I want to measure page load times, element interaction delays, and overall test execution performance.
```

## Tips for Effective AI-Assisted Testing

### 1. Be Specific About Requirements
- Mention specific browsers you want to target
- Describe the expected user journey in detail
- Specify any special requirements (accessibility, mobile, etc.)

### 2. Iterative Development
- Start with basic tests and gradually add complexity
- Ask Claude to explain the generated test code
- Request modifications and improvements iteratively

### 3. Leverage AI for Test Maintenance
- Ask Claude to update tests when the application changes
- Use AI to identify flaky tests and suggest fixes
- Get help with debugging test failures

### 4. Best Practices Integration
- Ask Claude to follow TestCafe best practices
- Request code reviews and suggestions for improvements
- Get help with test organization and structure

## Troubleshooting

### Common Issues

1. **MCP Server Not Loading**
   - Check the file path in the configuration
   - Ensure Node.js is installed and accessible
   - Verify the server builds successfully

2. **Browser Launch Failures**
   - Ask Claude to help configure browser settings
   - Get assistance with headless browser setup
   - Troubleshoot Docker/CI environment issues

3. **Test Reliability Issues**
   - Use Claude to analyze flaky tests
   - Get suggestions for better waiting strategies
   - Improve selector reliability with AI assistance

### Getting Help

When encountering issues, provide Claude with:
- Error messages and logs
- Your current configuration
- Description of what you're trying to achieve
- Any relevant code or test files

Claude can help diagnose problems and provide specific solutions using the TestCafe MCP Server tools.