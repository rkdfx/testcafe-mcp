# TestCafe MCP Server Troubleshooting Guide

This guide helps you diagnose and resolve common issues when using the TestCafe MCP Server.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Browser Launch Problems](#browser-launch-problems)
- [Test Execution Failures](#test-execution-failures)
- [Performance Issues](#performance-issues)
- [MCP Connection Problems](#mcp-connection-problems)
- [Debugging Techniques](#debugging-techniques)
- [Common Error Messages](#common-error-messages)
- [Environment-Specific Issues](#environment-specific-issues)

## Installation Issues

### Node.js Version Compatibility

**Problem**: Server fails to start with Node.js version errors.

**Solution**:
```bash
# Check Node.js version
node --version

# Should be >= 18.0.0
# If not, install a compatible version
nvm install 18
nvm use 18
```

### Dependency Installation Failures

**Problem**: `npm install` fails with permission or network errors.

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Use different registry if needed
npm install --registry https://registry.npmjs.org/

# Fix permissions (Linux/macOS)
sudo chown -R $(whoami) ~/.npm
```

### TypeScript Compilation Errors

**Problem**: Build fails with TypeScript errors.

**Solution**:
```bash
# Clean and rebuild
npm run clean
npm install
npm run build

# Check TypeScript version
npx tsc --version
```

## Browser Launch Problems

### Chrome/Chromium Not Found

**Problem**: TestCafe cannot launch Chrome browser.

**Solutions**:

**Ubuntu/Debian**:
```bash
# Install Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt update
sudo apt install google-chrome-stable

# Or install Chromium
sudo apt install chromium-browser
```

**CentOS/RHEL**:
```bash
# Install Chrome
sudo yum install -y google-chrome-stable

# Or install Chromium
sudo yum install -y chromium
```

**Docker Environment**:
```dockerfile
# Add to Dockerfile
RUN apt-get update && apt-get install -y \
    chromium-browser \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome path
ENV CHROME_BIN=/usr/bin/chromium-browser
```

### Headless Browser Issues

**Problem**: Headless browsers crash or fail to start.

**Solutions**:
```javascript
// Use additional Chrome flags
{
  "browsers": [{
    "name": "chrome",
    "headless": true,
    "args": [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
      "--memory-pressure-off"
    ]
  }]
}
```

### Permission Denied Errors

**Problem**: Browser fails to start due to permission issues.

**Solutions**:
```bash
# Fix Chrome sandbox permissions (Linux)
sudo chmod 4755 /usr/bin/google-chrome-stable

# Or disable sandbox (less secure)
# Add --no-sandbox to browser args
```

## Test Execution Failures

### Selector Not Found Errors

**Problem**: TestCafe cannot find elements using provided selectors.

**Debugging Steps**:
1. Use the inspect_page tool to verify element existence:
```javascript
await mcpClient.callTool('inspect_page', {
  operation: 'discover',
  target: { type: 'url', url: 'your-page-url' },
  executeLive: true
});
```

2. Check for timing issues:
```javascript
// Add explicit waits
{ type: 'wait', condition: 'element', value: '#your-selector', timeout: 10000 }
```

3. Use more robust selectors:
```javascript
// Instead of: '#button'
// Use: '[data-testid="submit-button"]'
// Or: 'button:contains("Submit")'
```

### Timeout Errors

**Problem**: Tests fail due to timeouts.

**Solutions**:
```javascript
// Increase global timeout
{
  "timeout": 60000,  // 60 seconds
  "pageLoadTimeout": 30000,
  "assertionTimeout": 10000,
  "selectorTimeout": 10000
}

// Add explicit waits in tests
{ type: 'wait', condition: 'timeout', value: 5000 }
```

### Network-Related Failures

**Problem**: Tests fail due to network issues or slow responses.

**Solutions**:
```javascript
// Configure network settings
{
  "testcafe": {
    "skipJsErrors": true,
    "skipUncaughtErrors": true,
    "pageRequestTimeout": 30000,
    "ajaxRequestTimeout": 20000
  }
}
```

### JavaScript Errors Breaking Tests

**Problem**: Page JavaScript errors cause test failures.

**Solutions**:
```javascript
// Skip JavaScript errors
{
  "skipJsErrors": true,
  "skipUncaughtErrors": true
}

// Or handle specific errors
{
  "clientScripts": [{
    "content": `
      window.addEventListener('error', function(e) {
        console.log('Caught error:', e.message);
        return true; // Prevent default handling
      });
    `
  }]
}
```

## Performance Issues

### Slow Test Execution

**Problem**: Tests run slower than expected.

**Solutions**:
```javascript
// Optimize browser settings
{
  "browsers": [{
    "name": "chrome",
    "headless": true,
    "args": [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-images",
      "--disable-javascript",  // If JS not needed
      "--memory-pressure-off"
    ]
  }],
  "speed": 1,  // Increase for faster execution
  "concurrency": 2  // Adjust based on system resources
}
```

### Memory Issues

**Problem**: High memory usage or out-of-memory errors.

**Solutions**:
```javascript
// Reduce concurrency
{
  "concurrency": 1,
  "quarantineMode": false
}

// Disable resource-intensive features
{
  "screenshots": false,
  "video": false
}

// Add memory limits (Docker)
docker run --memory=2g --shm-size=2g your-image
```

### CPU Usage Problems

**Problem**: High CPU usage affecting system performance.

**Solutions**:
```javascript
// Reduce test speed and concurrency
{
  "speed": 0.5,  // Slower execution
  "concurrency": 1,
  "timeout": 60000  // Longer timeouts to compensate
}
```

## MCP Connection Problems

### Server Won't Start

**Problem**: MCP server fails to initialize.

**Debugging Steps**:
```bash
# Check if port is available
netstat -tulpn | grep :1337

# Start with debug mode
DEBUG=* npm start

# Check logs
tail -f ~/.kiro/logs/mcp-server.log
```

### Client Connection Failures

**Problem**: MCP client cannot connect to server.

**Solutions**:
```json
// Check MCP configuration
{
  "mcpServers": {
    "testcafe": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/correct/path/to/testcafe-mcp-server",
      "env": {
        "NODE_ENV": "production",
        "DEBUG": "testcafe:*"
      }
    }
  }
}
```

### Tool Execution Timeouts

**Problem**: MCP tool calls timeout.

**Solutions**:
```javascript
// Increase MCP timeout
const result = await mcpClient.callTool('execute_test', params, {
  timeout: 300000  // 5 minutes
});

// Or break large operations into smaller chunks
```

## Debugging Techniques

### Enable Debug Logging

```bash
# Environment variable
DEBUG=testcafe:* npm start

# Or in configuration
{
  "server": {
    "debug": true,
    "logLevel": "verbose"
  }
}
```

### Capture Screenshots and Videos

```javascript
// Enable visual debugging
{
  "screenshots": true,
  "screenshotPath": "./debug-screenshots",
  "video": true,
  "videoPath": "./debug-videos",
  "screenshotPathPattern": "${DATE}_${TIME}/${FIXTURE}/${TEST}.png"
}
```

### Use Browser Developer Tools

```javascript
// Run in non-headless mode for debugging
{
  "browsers": ["chrome"],  // Remove :headless
  "speed": 0.1,  // Very slow for manual observation
  "debugMode": true
}
```

### Add Debug Information to Tests

```javascript
// Add console logging in generated tests
const testCode = `
import { Selector } from 'testcafe';

fixture('Debug Test')
  .page('your-url');

test('debug test', async t => {
  console.log('Starting test...');
  
  await t
    .expect(Selector('#element').exists).ok('Element should exist')
    .setTestSpeed(0.1)  // Slow down for observation
    .debug();  // Pause execution for debugging
});
`;
```

## Common Error Messages

### "Cannot establish one or more of the specified browser connections"

**Cause**: Browser launch failure or configuration issue.

**Solutions**:
1. Check browser installation
2. Verify browser path in configuration
3. Add appropriate browser flags
4. Check system permissions

### "The specified selector does not match any element in the DOM tree"

**Cause**: Element not found or timing issue.

**Solutions**:
1. Verify selector accuracy
2. Add explicit waits
3. Check for dynamic content loading
4. Use more robust selectors

### "A request has failed"

**Cause**: Network request timeout or failure.

**Solutions**:
1. Increase request timeouts
2. Check network connectivity
3. Verify target URL accessibility
4. Add retry logic

### "Cannot read property of undefined"

**Cause**: JavaScript error in test code or page.

**Solutions**:
1. Enable error skipping
2. Add null checks in test code
3. Verify page JavaScript compatibility
4. Use try-catch blocks

## Environment-Specific Issues

### Docker Containers

**Common Issues**:
- Shared memory limitations
- Missing browser dependencies
- Permission problems

**Solutions**:
```dockerfile
# Dockerfile optimizations
FROM node:18-slim

# Install browser dependencies
RUN apt-get update && apt-get install -y \
    chromium-browser \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set up user
RUN groupadd -r testcafe && useradd -r -g testcafe -G audio,video testcafe
USER testcafe

# Run with proper flags
CMD ["node", "dist/index.js"]
```

```bash
# Docker run command
docker run \
  --cap-add=SYS_ADMIN \
  --shm-size=2g \
  --security-opt seccomp=unconfined \
  your-testcafe-image
```

### CI/CD Environments

**GitHub Actions**:
```yaml
- name: Setup TestCafe MCP Server
  run: |
    sudo apt-get update
    sudo apt-get install -y chromium-browser
    npm ci
    npm run build
  env:
    CHROME_BIN: /usr/bin/chromium-browser
```

**Jenkins**:
```groovy
pipeline {
  agent any
  stages {
    stage('Test') {
      steps {
        sh 'Xvfb :99 -screen 0 1024x768x24 &'
        sh 'DISPLAY=:99 npm test'
      }
    }
  }
}
```

### Windows Environments

**Common Issues**:
- Path separator problems
- PowerShell execution policy
- Windows Defender interference

**Solutions**:
```powershell
# Set execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Exclude from Windows Defender
Add-MpPreference -ExclusionPath "C:\path\to\testcafe-mcp-server"
```

### macOS Environments

**Common Issues**:
- Gatekeeper blocking unsigned binaries
- Permission dialogs for screen recording

**Solutions**:
```bash
# Allow unsigned binaries (development only)
sudo spctl --master-disable

# Grant screen recording permissions
# System Preferences > Security & Privacy > Privacy > Screen Recording
```

## Getting Help

If you continue to experience issues:

1. **Check the logs**: Enable debug mode and examine detailed logs
2. **Search existing issues**: Check the GitHub repository for similar problems
3. **Create a minimal reproduction**: Isolate the problem to the smallest possible test case
4. **Gather system information**: Include OS, Node.js version, browser versions, and configuration
5. **Report the issue**: Create a detailed issue report with reproduction steps

### Issue Report Template

```markdown
## Environment
- OS: [e.g., Ubuntu 20.04, Windows 10, macOS 12]
- Node.js: [e.g., 18.17.0]
- TestCafe MCP Server: [e.g., 1.0.0]
- Browser: [e.g., Chrome 115.0.5790.110]

## Configuration
```json
{
  // Your configuration here
}
```

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Error Messages
```
Any error messages or logs
```

## Additional Context
Any other relevant information.
```

Remember: Most issues can be resolved by carefully checking configuration, ensuring proper browser setup, and using appropriate timeouts and error handling.