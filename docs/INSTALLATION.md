# TestCafe MCP Server Installation Guide

This comprehensive guide covers installation, configuration, and setup of the TestCafe MCP Server across different environments and platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
- [Platform-Specific Setup](#platform-specific-setup)
- [MCP Client Configuration](#mcp-client-configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (comes with Node.js)
- **Operating System**: 
  - Linux (Ubuntu 18.04+, CentOS 7+, Debian 9+)
  - macOS 10.15+
  - Windows 10/11
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Disk Space**: At least 2GB free space

### Browser Requirements

At least one of the following browsers must be installed:

- **Google Chrome** (recommended)
- **Mozilla Firefox**
- **Safari** (macOS only)
- **Microsoft Edge** (Windows only)

## Installation Methods

### Method 1: From Source (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/testcafe-mcp-server.git
cd testcafe-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Verify installation
npm test
```

### Method 2: Using npm (when published)

```bash
# Install globally
npm install -g testcafe-mcp-server

# Or install locally in your project
npm install testcafe-mcp-server
```

### Method 3: Using Docker

```bash
# Pull the Docker image
docker pull testcafe-mcp-server:latest

# Or build from source
git clone https://github.com/your-org/testcafe-mcp-server.git
cd testcafe-mcp-server
docker build -t testcafe-mcp-server .
```

## Platform-Specific Setup

### Ubuntu/Debian Linux

#### 1. Install Node.js

```bash
# Using NodeSource repository (recommended)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### 2. Install Browsers

```bash
# Install Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Install Firefox
sudo apt-get install -y firefox

# Install additional dependencies for headless operation
sudo apt-get install -y \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libxss1 \
  libxtst6 \
  xdg-utils
```

#### 3. Install TestCafe MCP Server

```bash
# Clone and build
git clone https://github.com/your-org/testcafe-mcp-server.git
cd testcafe-mcp-server
npm install
npm run build

# Create systemd service (optional)
sudo tee /etc/systemd/system/testcafe-mcp.service > /dev/null <<EOF
[Unit]
Description=TestCafe MCP Server
After=network.target

[Service]
Type=simple
User=testcafe
WorkingDirectory=/opt/testcafe-mcp-server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable testcafe-mcp
sudo systemctl start testcafe-mcp
```

### CentOS/RHEL Linux

#### 1. Install Node.js

```bash
# Using NodeSource repository
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Or using dnf on newer versions
sudo dnf install -y nodejs npm
```

#### 2. Install Browsers

```bash
# Install Chrome
sudo yum install -y wget
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo yum localinstall -y google-chrome-stable_current_x86_64.rpm

# Install Firefox
sudo yum install -y firefox

# Install additional dependencies
sudo yum install -y \
  liberation-fonts \
  alsa-lib \
  atk \
  gtk3 \
  libdrm \
  libXScrnSaver \
  libXtst \
  xorg-x11-server-Xvfb
```

### macOS

#### 1. Install Node.js

```bash
# Using Homebrew (recommended)
brew install node

# Or download from nodejs.org
# Visit https://nodejs.org and download the macOS installer
```

#### 2. Install Browsers

```bash
# Install Chrome
brew install --cask google-chrome

# Install Firefox
brew install --cask firefox

# Safari is pre-installed on macOS
```

#### 3. Install TestCafe MCP Server

```bash
# Clone and build
git clone https://github.com/your-org/testcafe-mcp-server.git
cd testcafe-mcp-server
npm install
npm run build

# Create launchd service (optional)
mkdir -p ~/Library/LaunchAgents
tee ~/Library/LaunchAgents/com.testcafe.mcp.plist > /dev/null <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.testcafe.mcp</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/testcafe-mcp-server</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

# Load the service
launchctl load ~/Library/LaunchAgents/com.testcafe.mcp.plist
```

### Windows

#### 1. Install Node.js

```powershell
# Using Chocolatey (recommended)
choco install nodejs

# Or using Scoop
scoop install nodejs

# Or download from nodejs.org
# Visit https://nodejs.org and download the Windows installer
```

#### 2. Install Browsers

```powershell
# Install Chrome
choco install googlechrome

# Install Firefox
choco install firefox

# Edge is pre-installed on Windows 10/11
```

#### 3. Install TestCafe MCP Server

```powershell
# Clone and build
git clone https://github.com/your-org/testcafe-mcp-server.git
cd testcafe-mcp-server
npm install
npm run build

# Create Windows service using NSSM (optional)
choco install nssm
nssm install TestCafeMCP "C:\Program Files\nodejs\node.exe"
nssm set TestCafeMCP AppDirectory "C:\path\to\testcafe-mcp-server"
nssm set TestCafeMCP AppParameters "dist\index.js"
nssm start TestCafeMCP
```

## MCP Client Configuration

### Kiro IDE

Create or update `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "testcafe": {
      "command": "node",
      "args": ["./testcafe-mcp-server/dist/index.js"],
      "cwd": ".",
      "env": {
        "NODE_ENV": "development"
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

### Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "testcafe": {
      "command": "node",
      "args": ["/absolute/path/to/testcafe-mcp-server/dist/index.js"]
    }
  }
}
```

### Continue.dev

Create `.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "testcafe",
      "serverPath": "./testcafe-mcp-server/dist/index.js"
    }
  ]
}
```

### Generic MCP Client

```json
{
  "servers": {
    "testcafe": {
      "command": "node",
      "args": ["./testcafe-mcp-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Docker Installation

### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  testcafe-mcp:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./tests:/app/tests
      - ./screenshots:/app/screenshots
      - ./videos:/app/videos
    environment:
      - NODE_ENV=production
    cap_add:
      - SYS_ADMIN
    shm_size: 2gb
    security_opt:
      - seccomp:unconfined
```

Run with:

```bash
docker-compose up -d
```

### Using Docker Run

```bash
docker run -d \
  --name testcafe-mcp \
  --cap-add=SYS_ADMIN \
  --shm-size=2g \
  --security-opt seccomp=unconfined \
  -p 3000:3000 \
  -v $(pwd)/tests:/app/tests \
  -v $(pwd)/screenshots:/app/screenshots \
  testcafe-mcp-server
```

## Verification

### 1. Test Server Startup

```bash
# Start the server
cd testcafe-mcp-server
npm start

# You should see output like:
# TestCafe MCP Server starting...
# Server listening on stdio
# Available tools: create_test, execute_test, validate_test, interact, inspect_page
```

### 2. Test MCP Connection

Create a test script `test-mcp.js`:

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testConnection() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js']
  });

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('✅ MCP connection successful');

    const tools = await client.request({ method: 'tools/list' }, {});
    console.log('✅ Available tools:', tools.tools.map(t => t.name));

    await client.close();
  } catch (error) {
    console.error('❌ MCP connection failed:', error);
  }
}

testConnection();
```

Run the test:

```bash
node test-mcp.js
```

### 3. Test Browser Integration

```bash
# Run the integration tests
npm run test:integration

# Or test specific browser
npm run test -- --browser=chrome:headless
```

### 4. Test Tool Functionality

Create `test-tools.js`:

```javascript
// Test create_test tool
const result = await client.request(
  { method: 'tools/call' },
  {
    name: 'create_test',
    arguments: {
      testStructure: {
        fixture: 'Test Installation',
        url: 'data:text/html,<h1>Hello World</h1>',
        tests: [{
          name: 'should verify installation',
          actions: [
            { type: 'assert', selector: 'h1' }
          ]
        }]
      },
      outputPath: './test-installation.js'
    }
  }
);

console.log('✅ Test creation successful');
```

## Configuration Options

### Environment Variables

```bash
# Server configuration
export NODE_ENV=production
export DEBUG=testcafe:*
export MCP_SERVER_PORT=3000

# Browser configuration
export CHROME_BIN=/usr/bin/google-chrome-stable
export FIREFOX_BIN=/usr/bin/firefox

# Test configuration
export TESTCAFE_TIMEOUT=30000
export TESTCAFE_SPEED=1
export TESTCAFE_CONCURRENCY=2
```

### Configuration File

Create `config/production.json`:

```json
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
        "args": [
          "--no-sandbox",
          "--disable-dev-shm-usage"
        ]
      }
    ],
    "timeout": 30000,
    "speed": 1,
    "concurrency": 2,
    "screenshots": {
      "enabled": true,
      "path": "./screenshots"
    },
    "video": {
      "enabled": false
    }
  }
}
```

## Performance Optimization

### System Tuning

```bash
# Increase file descriptor limits
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Increase shared memory for Chrome
echo "tmpfs /dev/shm tmpfs defaults,size=2g 0 0" | sudo tee -a /etc/fstab

# Optimize kernel parameters
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Browser Optimization

```json
{
  "browsers": [{
    "name": "chrome",
    "headless": true,
    "args": [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--memory-pressure-off",
      "--max_old_space_size=4096"
    ]
  }]
}
```

## Security Considerations

### Network Security

```bash
# Firewall configuration (if needed)
sudo ufw allow from 127.0.0.1 to any port 3000
sudo ufw deny 3000
```

### File Permissions

```bash
# Set appropriate permissions
chmod 755 dist/index.js
chmod -R 644 config/
chmod -R 755 screenshots/ videos/
```

### User Isolation

```bash
# Create dedicated user
sudo useradd -r -s /bin/false testcafe
sudo chown -R testcafe:testcafe /opt/testcafe-mcp-server
```

## Troubleshooting Installation

### Common Issues

1. **Node.js Version Mismatch**
   ```bash
   # Check version
   node --version
   
   # Update if needed
   npm install -g n
   n 18
   ```

2. **Permission Errors**
   ```bash
   # Fix npm permissions
   sudo chown -R $(whoami) ~/.npm
   
   # Or use nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

3. **Browser Launch Failures**
   ```bash
   # Check browser installation
   google-chrome --version
   firefox --version
   
   # Install missing dependencies
   sudo apt-get install -y libgconf-2-4 libxss1 libxtst6 libxrandr2 libasound2 libpangocairo-1.0-0 libatk1.0-0 libcairo-gobject2 libgtk-3-0 libgdk-pixbuf2.0-0
   ```

4. **Build Failures**
   ```bash
   # Clear cache and rebuild
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

### Getting Help

If you encounter issues during installation:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review the logs: `DEBUG=testcafe:* npm start`
3. Create an issue on GitHub with:
   - Operating system and version
   - Node.js version
   - Complete error messages
   - Steps to reproduce

## Next Steps

After successful installation:

1. Read the [API Documentation](./API.md)
2. Try the [Examples](../examples/)
3. Configure your preferred MCP client
4. Start creating tests with AI assistance!

The TestCafe MCP Server is now ready to help you create, execute, and manage automated browser tests through AI-powered interactions.