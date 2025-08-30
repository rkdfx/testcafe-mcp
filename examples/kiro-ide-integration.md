# Kiro IDE Integration Example

This guide demonstrates how to integrate the TestCafe MCP Server with Kiro IDE for seamless AI-assisted test development.

## Setup

### 1. Install TestCafe MCP Server

```bash
# In your project directory
git clone <repository-url> testcafe-mcp-server
cd testcafe-mcp-server
npm install
npm run build
```

### 2. Configure Kiro IDE MCP Settings

Create or update `.kiro/settings/mcp.json` in your project:

```json
{
  "mcpServers": {
    "testcafe": {
      "command": "node",
      "args": ["./testcafe-mcp-server/dist/index.js"],
      "cwd": ".",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "testcafe:info"
      },
      "disabled": false,
      "autoApprove": [
        "create_test",
        "validate_test",
        "inspect_page"
      ]
    }
  }
}
```

### 3. Restart Kiro IDE

Restart Kiro IDE or reload the MCP servers from the command palette:
- `Cmd/Ctrl + Shift + P` → "MCP: Reload Servers"

## Kiro IDE Workflow Examples

### Example 1: AI-Driven Test Creation

1. **Open a new chat in Kiro**
2. **Use context references:**
   ```
   I want to create tests for my web application. Here's the login page: #https://myapp.com/login
   
   Please analyze the page structure and create comprehensive login tests including:
   - Valid login flow
   - Invalid credentials handling
   - Form validation
   - Remember me functionality
   ```

3. **Kiro will automatically:**
   - Use `inspect_page` to analyze the URL
   - Generate TestCafe test files
   - Save them to your project
   - Validate the generated code

### Example 2: Test File Enhancement

1. **Reference existing test file:**
   ```
   #File: tests/login.test.js
   
   Please review this test file and:
   - Add better error handling
   - Improve selector reliability
   - Add more comprehensive assertions
   - Follow TestCafe best practices
   ```

2. **Kiro will:**
   - Analyze your existing test file
   - Use `validate_test` to check for issues
   - Suggest and implement improvements
   - Update the file with enhanced code

### Example 3: Interactive Test Development

1. **Start interactive session:**
   ```
   I want to create tests for my e-commerce site step by step. Let's start by exploring the homepage at https://mystore.com and then build tests for the shopping flow.
   ```

2. **Kiro will:**
   - Use live browser interaction
   - Generate tests based on real user actions
   - Create comprehensive test suites
   - Save everything to your project structure

### Example 4: Debugging Test Failures

1. **Reference failing test:**
   ```
   #File: tests/checkout.test.js
   
   This test is failing intermittently. Can you help me:
   - Identify potential timing issues
   - Improve element waiting strategies
   - Add better error handling
   - Make the test more reliable
   ```

2. **Kiro will:**
   - Analyze the test code
   - Suggest reliability improvements
   - Help implement better waiting strategies
   - Add debugging capabilities

## Advanced Kiro IDE Features

### Using Kiro Hooks for Automated Testing

Create a Kiro hook to automatically run tests when files change:

1. **Open Kiro Hook UI:** `Cmd/Ctrl + Shift + P` → "Open Kiro Hook UI"

2. **Create Test Runner Hook:**
   ```javascript
   // Hook: Auto-run tests on file save
   {
     "name": "Auto Test Runner",
     "trigger": "file_save",
     "filePattern": "src/**/*.{js,ts,jsx,tsx}",
     "action": "Run related tests using TestCafe MCP Server"
   }
   ```

3. **The hook will:**
   - Detect file changes in your source code
   - Automatically identify related test files
   - Execute tests using the TestCafe MCP Server
   - Show results in Kiro's output panel

### Kiro Steering for TestCafe Standards

Create steering rules for consistent test development:

**`.kiro/steering/testcafe-standards.md`:**
```markdown
---
inclusion: fileMatch
fileMatchPattern: "**/*.test.{js,ts}"
---

# TestCafe Testing Standards

When creating or modifying TestCafe tests:

1. **Selector Strategy:**
   - Prefer data-testid attributes: `[data-testid="submit-button"]`
   - Use semantic selectors when possible
   - Avoid brittle CSS selectors based on styling

2. **Test Structure:**
   - Use descriptive fixture and test names
   - Group related tests in the same fixture
   - Add proper setup and teardown

3. **Assertions:**
   - Use specific assertions with clear error messages
   - Test both positive and negative scenarios
   - Include accessibility checks where relevant

4. **Error Handling:**
   - Add proper timeouts for async operations
   - Use explicit waits instead of arbitrary delays
   - Handle network failures gracefully

5. **Best Practices:**
   - Keep tests independent and isolated
   - Use page object patterns for complex applications
   - Document complex test logic with comments
```

### Project-Specific Configuration

**`.kiro/steering/project-testing.md`:**
```markdown
---
inclusion: always
---

# Project Testing Configuration

## Application URLs
- Development: https://dev.myapp.com
- Staging: https://staging.myapp.com
- Production: https://myapp.com

## Test Data
- Use test user accounts: testuser1@example.com / testpass123
- Test credit card: 4111 1111 1111 1111
- Test addresses available in fixtures/addresses.json

## Browser Configuration
- Primary: Chrome headless for CI/CD
- Cross-browser: Chrome, Firefox, Safari for release testing
- Mobile: Chrome mobile emulation for responsive tests

## File Organization
- Unit tests: tests/unit/
- Integration tests: tests/integration/
- E2E tests: tests/e2e/
- Page objects: tests/page-objects/
- Fixtures: tests/fixtures/
```

## Kiro IDE Specific Features

### 1. Context-Aware Test Generation

```
#Codebase #File:src/components/LoginForm.jsx

Create comprehensive tests for this login form component. Include tests for:
- Form validation
- Successful login
- Error handling
- Accessibility compliance
```

### 2. Multi-File Test Suites

```
#Folder:src/components/checkout/

I need a complete test suite for the checkout process. Please:
1. Analyze all components in this folder
2. Create integration tests for the full checkout flow
3. Add unit tests for individual components
4. Set up proper test data and mocks
```

### 3. Git Integration

```
#Git Diff

I've made changes to the user registration flow. Please:
1. Identify what tests need to be updated
2. Create new tests for the changed functionality
3. Ensure all edge cases are covered
4. Update existing tests that might be affected
```

### 4. Problem-Driven Testing

```
#Problems

I see there are some linting errors and type issues. Can you:
1. Create tests that would catch these issues earlier
2. Add integration tests to prevent regressions
3. Set up proper test coverage for the affected areas
```

## Workflow Integration

### Development Workflow

1. **Feature Development:**
   - Write feature code
   - Ask Kiro to generate tests
   - Review and refine tests
   - Run tests locally

2. **Code Review:**
   - Include generated tests in PR
   - Use Kiro to explain test coverage
   - Get suggestions for additional test cases

3. **CI/CD Integration:**
   - Tests run automatically in pipeline
   - Kiro helps debug failures
   - Generates reports and insights

### Maintenance Workflow

1. **Regular Test Updates:**
   - Kiro identifies outdated tests
   - Suggests improvements and updates
   - Helps refactor test suites

2. **Performance Monitoring:**
   - Track test execution times
   - Identify slow or flaky tests
   - Get optimization suggestions

## Tips for Effective Kiro + TestCafe Usage

### 1. Leverage Context
- Use `#File`, `#Folder`, `#Codebase` references
- Include relevant documentation and specs
- Reference existing test patterns

### 2. Iterative Development
- Start with basic test structure
- Gradually add complexity
- Use Kiro's suggestions for improvements

### 3. Maintain Test Quality
- Regular test reviews with Kiro
- Continuous refactoring and optimization
- Keep tests aligned with application changes

### 4. Team Collaboration
- Share Kiro steering rules across team
- Establish consistent testing patterns
- Use Kiro for test code reviews

## Troubleshooting in Kiro IDE

### MCP Server Issues

1. **Check MCP Server Status:**
   - Open Kiro feature panel
   - Check MCP Server view
   - Look for connection status and errors

2. **Debug Configuration:**
   ```
   My TestCafe MCP server isn't working. Here's my configuration:
   #File:.kiro/settings/mcp.json
   
   Can you help me debug this?
   ```

3. **Restart MCP Servers:**
   - Command palette: "MCP: Restart Servers"
   - Or restart Kiro IDE completely

### Test Execution Issues

```
I'm having trouble with test execution. The tests are failing with browser launch errors. Can you help me:
1. Check the browser configuration
2. Suggest alternative browser settings
3. Help set up proper CI/CD configuration
```

This integration makes TestCafe testing seamless within Kiro IDE, leveraging AI assistance for comprehensive test development and maintenance.