# CI/CD Integration Examples

This document provides examples for integrating TestCafe MCP Server with various CI/CD platforms.

## GitHub Actions

### Basic Workflow

```yaml
name: TestCafe MCP Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
        browser: [chrome, firefox]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm ci
        sudo apt-get update
        sudo apt-get install -y chromium-browser firefox
    
    - name: Build TestCafe MCP Server
      run: |
        cd testcafe-mcp-server
        npm ci
        npm run build
    
    - name: Run tests
      run: |
        node testcafe-mcp-server/dist/index.js &
        MCP_PID=$!
        sleep 5
        npm test -- --browser=${{ matrix.browser }}:headless
        kill $MCP_PID
      env:
        CI: true
        CHROME_BIN: /usr/bin/chromium-browser
        FIREFOX_BIN: /usr/bin/firefox
    
    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: test-results-${{ matrix.node-version }}-${{ matrix.browser }}
        path: |
          test-results/
          screenshots/
          videos/
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      if: matrix.node-version == '18.x' && matrix.browser == 'chrome'
```

### Advanced Workflow with MCP Integration

```yaml
name: Advanced TestCafe MCP Testing

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      test-matrix: ${{ steps.generate-matrix.outputs.matrix }}
    steps:
    - uses: actions/checkout@v4
    - name: Generate test matrix
      id: generate-matrix
      run: |
        # Generate dynamic test matrix based on changed files
        echo "matrix=$(node scripts/generate-test-matrix.js)" >> $GITHUB_OUTPUT

  test:
    needs: setup
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{ fromJson(needs.setup.outputs.test-matrix) }}
      fail-fast: false
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install system dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y \
          chromium-browser \
          firefox \
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
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build and start TestCafe MCP Server
      run: |
        cd testcafe-mcp-server
        npm ci
        npm run build
        node dist/index.js &
        echo $! > mcp-server.pid
        sleep 10
    
    - name: Run AI-generated tests
      run: |
        # Use MCP client to generate and run tests
        node scripts/ai-test-runner.js \
          --suite=${{ matrix.suite }} \
          --browser=${{ matrix.browser }} \
          --environment=${{ matrix.environment }}
      env:
        MCP_SERVER_URL: http://localhost:3000
        TEST_ENVIRONMENT: ${{ matrix.environment }}
        BROWSER_CONFIG: ${{ matrix.browser }}
    
    - name: Generate test report
      if: always()
      run: |
        node scripts/generate-report.js \
          --results=test-results/ \
          --format=html,json \
          --output=reports/
    
    - name: Stop MCP Server
      if: always()
      run: |
        if [ -f mcp-server.pid ]; then
          kill $(cat mcp-server.pid) || true
        fi
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: test-artifacts-${{ matrix.suite }}-${{ matrix.browser }}
        path: |
          reports/
          screenshots/
          videos/
          test-results/
        retention-days: 30

  deploy-reports:
    needs: test
    runs-on: ubuntu-latest
    if: always()
    steps:
    - name: Download all artifacts
      uses: actions/download-artifact@v4
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./reports
```

## Jenkins Pipeline

### Declarative Pipeline

```groovy
pipeline {
    agent any
    
    parameters {
        choice(
            name: 'BROWSER',
            choices: ['chrome', 'firefox', 'safari'],
            description: 'Browser to run tests on'
        )
        choice(
            name: 'ENVIRONMENT',
            choices: ['dev', 'staging', 'prod'],
            description: 'Environment to test against'
        )
        booleanParam(
            name: 'GENERATE_TESTS',
            defaultValue: false,
            description: 'Generate new tests using AI'
        )
    }
    
    environment {
        NODE_VERSION = '18'
        CHROME_BIN = '/usr/bin/google-chrome-stable'
        FIREFOX_BIN = '/usr/bin/firefox'
        MCP_SERVER_PORT = '3000'
    }
    
    stages {
        stage('Setup') {
            steps {
                // Install Node.js
                sh '''
                    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
                    sudo apt-get install -y nodejs
                '''
                
                // Install browsers
                sh '''
                    sudo apt-get update
                    sudo apt-get install -y google-chrome-stable firefox
                '''
                
                // Install dependencies
                sh 'npm ci'
                
                // Build TestCafe MCP Server
                sh '''
                    cd testcafe-mcp-server
                    npm ci
                    npm run build
                '''
            }
        }
        
        stage('Start MCP Server') {
            steps {
                sh '''
                    cd testcafe-mcp-server
                    nohup node dist/index.js > mcp-server.log 2>&1 &
                    echo $! > ../mcp-server.pid
                    sleep 10
                '''
            }
        }
        
        stage('Generate Tests') {
            when {
                params.GENERATE_TESTS == true
            }
            steps {
                sh '''
                    node scripts/ai-test-generator.js \
                        --environment=${ENVIRONMENT} \
                        --browser=${BROWSER} \
                        --output=tests/generated/
                '''
            }
        }
        
        stage('Run Tests') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'npm run test:unit'
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'test-results/unit/*.xml'
                        }
                    }
                }
                
                stage('Integration Tests') {
                    steps {
                        sh '''
                            node scripts/mcp-test-runner.js \
                                --suite=integration \
                                --browser=${BROWSER}:headless \
                                --environment=${ENVIRONMENT}
                        '''
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'test-results/integration/*.xml'
                            archiveArtifacts artifacts: 'screenshots/**, videos/**', allowEmptyArchive: true
                        }
                    }
                }
                
                stage('E2E Tests') {
                    steps {
                        sh '''
                            node scripts/mcp-test-runner.js \
                                --suite=e2e \
                                --browser=${BROWSER}:headless \
                                --environment=${ENVIRONMENT} \
                                --parallel=2
                        '''
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'test-results/e2e/*.xml'
                            archiveArtifacts artifacts: 'screenshots/**, videos/**', allowEmptyArchive: true
                        }
                    }
                }
            }
        }
        
        stage('Generate Reports') {
            steps {
                sh '''
                    node scripts/report-generator.js \
                        --input=test-results/ \
                        --output=reports/ \
                        --format=html,json,junit
                '''
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'reports',
                        reportFiles: 'index.html',
                        reportName: 'TestCafe Test Report'
                    ])
                }
            }
        }
    }
    
    post {
        always {
            // Stop MCP Server
            sh '''
                if [ -f mcp-server.pid ]; then
                    kill $(cat mcp-server.pid) || true
                    rm mcp-server.pid
                fi
            '''
            
            // Clean up
            sh 'npm run clean'
        }
        
        success {
            slackSend(
                channel: '#testing',
                color: 'good',
                message: "✅ TestCafe tests passed for ${env.BRANCH_NAME} - ${env.BUILD_URL}"
            )
        }
        
        failure {
            slackSend(
                channel: '#testing',
                color: 'danger',
                message: "❌ TestCafe tests failed for ${env.BRANCH_NAME} - ${env.BUILD_URL}"
            )
        }
    }
}
```

## GitLab CI/CD

```yaml
# .gitlab-ci.yml
stages:
  - setup
  - test
  - report
  - deploy

variables:
  NODE_VERSION: "18"
  CHROME_BIN: "/usr/bin/google-chrome-stable"
  FIREFOX_BIN: "/usr/bin/firefox"

.browser_template: &browser_template
  image: node:18-slim
  before_script:
    - apt-get update -qq
    - apt-get install -y -qq wget gnupg
    - wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
    - echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list
    - apt-get update -qq
    - apt-get install -y -qq google-chrome-stable firefox fonts-liberation
    - npm ci
    - cd testcafe-mcp-server && npm ci && npm run build && cd ..

setup:
  stage: setup
  <<: *browser_template
  script:
    - echo "Setup completed"
  artifacts:
    paths:
      - node_modules/
      - testcafe-mcp-server/dist/
    expire_in: 1 hour

test:chrome:
  stage: test
  <<: *browser_template
  script:
    - cd testcafe-mcp-server && node dist/index.js &
    - MCP_PID=$!
    - sleep 10
    - node scripts/mcp-test-runner.js --browser=chrome:headless --suite=all
    - kill $MCP_PID
  artifacts:
    when: always
    paths:
      - test-results/
      - screenshots/
      - videos/
    reports:
      junit: test-results/junit.xml
    expire_in: 1 week

test:firefox:
  stage: test
  <<: *browser_template
  script:
    - cd testcafe-mcp-server && node dist/index.js &
    - MCP_PID=$!
    - sleep 10
    - node scripts/mcp-test-runner.js --browser=firefox:headless --suite=all
    - kill $MCP_PID
  artifacts:
    when: always
    paths:
      - test-results/
      - screenshots/
      - videos/
    reports:
      junit: test-results/junit.xml
    expire_in: 1 week

test:mobile:
  stage: test
  <<: *browser_template
  script:
    - cd testcafe-mcp-server && node dist/index.js &
    - MCP_PID=$!
    - sleep 10
    - node scripts/mcp-test-runner.js --browser=chrome:headless --device=mobile --suite=responsive
    - kill $MCP_PID
  artifacts:
    when: always
    paths:
      - test-results/
      - screenshots/
    expire_in: 1 week

generate_report:
  stage: report
  image: node:18-slim
  dependencies:
    - test:chrome
    - test:firefox
    - test:mobile
  script:
    - npm install
    - node scripts/merge-reports.js
    - node scripts/generate-html-report.js
  artifacts:
    paths:
      - reports/
    expire_in: 1 month

pages:
  stage: deploy
  dependencies:
    - generate_report
  script:
    - mkdir public
    - cp -r reports/* public/
  artifacts:
    paths:
      - public
  only:
    - main
```

## Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
    - main
    - develop
  paths:
    exclude:
    - docs/*
    - README.md

pr:
  branches:
    include:
    - main

variables:
  nodeVersion: '18.x'
  chromeVersion: 'stable'

stages:
- stage: Test
  displayName: 'Run TestCafe MCP Tests'
  jobs:
  - job: TestMatrix
    displayName: 'Test Matrix'
    strategy:
      matrix:
        Chrome_Linux:
          imageName: 'ubuntu-latest'
          browserName: 'chrome'
        Firefox_Linux:
          imageName: 'ubuntu-latest'
          browserName: 'firefox'
        Chrome_Windows:
          imageName: 'windows-latest'
          browserName: 'chrome'
        Chrome_macOS:
          imageName: 'macOS-latest'
          browserName: 'chrome'
    
    pool:
      vmImage: $(imageName)
    
    steps:
    - task: NodeTool@0
      displayName: 'Install Node.js'
      inputs:
        versionSpec: $(nodeVersion)
    
    - script: |
        sudo apt-get update
        sudo apt-get install -y google-chrome-stable firefox
      displayName: 'Install browsers (Linux)'
      condition: eq(variables['Agent.OS'], 'Linux')
    
    - script: |
        choco install googlechrome firefox
      displayName: 'Install browsers (Windows)'
      condition: eq(variables['Agent.OS'], 'Windows_NT')
    
    - script: |
        brew install --cask google-chrome firefox
      displayName: 'Install browsers (macOS)'
      condition: eq(variables['Agent.OS'], 'Darwin')
    
    - script: npm ci
      displayName: 'Install dependencies'
    
    - script: |
        cd testcafe-mcp-server
        npm ci
        npm run build
      displayName: 'Build TestCafe MCP Server'
    
    - script: |
        cd testcafe-mcp-server
        node dist/index.js &
        MCP_PID=$!
        sleep 10
        cd ..
        node scripts/mcp-test-runner.js --browser=$(browserName) --suite=all
        kill $MCP_PID
      displayName: 'Run tests (Linux/macOS)'
      condition: ne(variables['Agent.OS'], 'Windows_NT')
    
    - script: |
        cd testcafe-mcp-server
        start /b node dist/index.js
        timeout /t 10
        cd ..
        node scripts/mcp-test-runner.js --browser=$(browserName) --suite=all
      displayName: 'Run tests (Windows)'
      condition: eq(variables['Agent.OS'], 'Windows_NT')
    
    - task: PublishTestResults@2
      displayName: 'Publish test results'
      condition: always()
      inputs:
        testResultsFormat: 'JUnit'
        testResultsFiles: 'test-results/junit.xml'
        testRunTitle: 'TestCafe Tests - $(browserName) on $(imageName)'
    
    - task: PublishBuildArtifacts@1
      displayName: 'Publish artifacts'
      condition: always()
      inputs:
        pathToPublish: 'screenshots'
        artifactName: 'screenshots-$(browserName)-$(imageName)'
    
    - task: PublishBuildArtifacts@1
      displayName: 'Publish videos'
      condition: always()
      inputs:
        pathToPublish: 'videos'
        artifactName: 'videos-$(browserName)-$(imageName)'

- stage: Report
  displayName: 'Generate Reports'
  dependsOn: Test
  condition: always()
  jobs:
  - job: GenerateReport
    displayName: 'Generate Test Report'
    pool:
      vmImage: 'ubuntu-latest'
    
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: $(nodeVersion)
    
    - script: npm ci
      displayName: 'Install dependencies'
    
    - task: DownloadBuildArtifacts@0
      displayName: 'Download all artifacts'
      inputs:
        buildType: 'current'
        downloadType: 'all'
        downloadPath: '$(System.ArtifactsDirectory)'
    
    - script: |
        node scripts/merge-test-results.js $(System.ArtifactsDirectory)
        node scripts/generate-html-report.js
      displayName: 'Generate consolidated report'
    
    - task: PublishBuildArtifacts@1
      displayName: 'Publish final report'
      inputs:
        pathToPublish: 'reports'
        artifactName: 'test-reports'
```

## Docker-based CI/CD

### Multi-stage Dockerfile for CI

```dockerfile
# Dockerfile.ci
FROM node:18-slim as base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update \
    && apt-get install -y \
        google-chrome-stable \
        firefox-esr \
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
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r testcafe && useradd -r -g testcafe -G audio,video testcafe

FROM base as dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base as development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN chown -R testcafe:testcafe /app

FROM development as test
USER testcafe
ENV CHROME_BIN=/usr/bin/google-chrome-stable
ENV FIREFOX_BIN=/usr/bin/firefox-esr
RUN npm run build
CMD ["npm", "test"]

FROM dependencies as production
COPY --from=development /app/dist ./dist
COPY --from=development /app/package.json ./
USER testcafe
CMD ["node", "dist/index.js"]
```

### Docker Compose for Testing

```yaml
# docker-compose.test.yml
version: '3.8'

services:
  testcafe-mcp:
    build:
      context: .
      dockerfile: Dockerfile.ci
      target: test
    volumes:
      - ./test-results:/app/test-results
      - ./screenshots:/app/screenshots
      - ./videos:/app/videos
    environment:
      - NODE_ENV=test
      - CI=true
    cap_add:
      - SYS_ADMIN
    shm_size: 2gb
    security_opt:
      - seccomp:unconfined

  test-runner:
    build:
      context: .
      dockerfile: Dockerfile.ci
      target: development
    depends_on:
      - testcafe-mcp
    volumes:
      - ./scripts:/app/scripts
      - ./test-results:/app/test-results
    environment:
      - MCP_SERVER_URL=http://testcafe-mcp:3000
    command: node scripts/ci-test-runner.js
```

## Best Practices for CI/CD Integration

### 1. Environment Configuration

```javascript
// config/ci.js
module.exports = {
  testcafe: {
    browsers: process.env.CI ? ['chrome:headless', 'firefox:headless'] : ['chrome'],
    concurrency: process.env.CI ? 2 : 1,
    speed: process.env.CI ? 1 : 0.5,
    timeout: process.env.CI ? 60000 : 30000,
    screenshots: {
      enabled: true,
      path: process.env.CI ? './ci-screenshots' : './screenshots',
      takeOnFails: true,
      pathPattern: '${DATE}_${TIME}/${FIXTURE}/${TEST}_${FILE_INDEX}.png'
    },
    video: {
      enabled: process.env.CI ? false : true, // Disable video in CI for performance
      path: './videos'
    }
  }
};
```

### 2. Retry and Stability

```javascript
// scripts/ci-test-runner.js
const { execSync } = require('child_process');

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function runTestsWithRetry(testCommand, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      execSync(testCommand, { stdio: 'inherit' });
      return; // Success
    } catch (error) {
      console.log(`Test attempt ${i + 1} failed`);
      if (i === retries - 1) throw error;
      
      console.log(`Retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}
```

### 3. Parallel Test Execution

```javascript
// scripts/parallel-test-runner.js
const { spawn } = require('child_process');

const testSuites = [
  { name: 'auth', browser: 'chrome:headless' },
  { name: 'navigation', browser: 'firefox:headless' },
  { name: 'forms', browser: 'chrome:headless' },
  { name: 'e2e', browser: 'firefox:headless' }
];

async function runTestsInParallel() {
  const promises = testSuites.map(suite => {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [
        'scripts/mcp-test-runner.js',
        `--suite=${suite.name}`,
        `--browser=${suite.browser}`,
        `--output=test-results/${suite.name}`
      ]);
      
      child.on('close', code => {
        if (code === 0) resolve(suite);
        else reject(new Error(`Suite ${suite.name} failed with code ${code}`));
      });
    });
  });
  
  return Promise.all(promises);
}
```

This comprehensive CI/CD integration guide ensures reliable, scalable test execution across different platforms and environments.