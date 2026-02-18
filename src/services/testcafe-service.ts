/**
 * TestCafe Service Layer
 * 
 * Provides core TestCafe functionality including test creation, execution, and validation.
 */

import { TestCafeConfig, BrowserConfig } from '../config/index.js';
import { z } from 'zod';
import { performanceMonitor } from './performance-monitor.js';

/**
 * Test file structure schema
 */
export const TestStructureSchema = z.object({
  fixture: z.string().min(1),
  url: z.string().url().optional(),
  tests: z.array(z.object({
    name: z.string().min(1),
    actions: z.array(z.object({
      type: z.enum(['navigate', 'click', 'type', 'wait', 'assert']),
      selector: z.string().optional(),
      value: z.string().optional(),
      timeout: z.number().optional()
    }))
  })).min(1)
});

/**
 * Test execution result
 */
export interface TestExecutionResult {
  success: boolean;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  duration: number;
  errors: Array<{
    testName: string;
    error: string;
    stack?: string;
  }>;
  warnings: string[];
  screenshots?: string[];
  videos?: string[];
  reportPath?: string;
  metadata?: {
    browserVersions?: string[];
    testEnvironment?: string;
    executionId?: string;
    performanceMetrics?: {
      browserLaunchTime: number;
      totalExecutionTime: number;
      systemStress: boolean;
    };
  };
}

/**
 * Test validation result
 */
export interface TestValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type TestStructure = z.infer<typeof TestStructureSchema>;

/**
 * TestCafe Service
 * 
 * Handles TestCafe operations including test creation, execution, and validation.
 */
export class TestCafeService {
  private config: TestCafeConfig;
  private testCafe: any | null = null;

  constructor(config: TestCafeConfig) {
    this.config = config;
  }

  /**
   * Initialize TestCafe instance
   */
  async initialize(): Promise<void> {
    if (!this.testCafe) {
      const { default: createTestCafe } = await import('testcafe');
      this.testCafe = await createTestCafe('localhost', 1337, 1338);
    }
  }

  /**
   * Close TestCafe instance
   */
  async close(): Promise<void> {
    if (this.testCafe) {
      await this.testCafe.close();
      this.testCafe = null;
    }
  }

  /**
   * Create a test file from test structure
   */
  createTestFile(structure: TestStructure): string {
    this.validateTestStructure(structure);
    
    let testCode = `import { Selector } from 'testcafe';\n\n`;
    
    // Add fixture
    testCode += `fixture('${this.escapeString(structure.fixture)}')`;
    if (structure.url) {
      testCode += `\n  .page('${structure.url}')`;
    }
    testCode += ';\n\n';

    // Add tests
    structure.tests.forEach(test => {
      testCode += `test('${this.escapeString(test.name)}', async t => {\n`;
      
      test.actions.forEach(action => {
        testCode += this.generateActionCode(action, 2);
      });
      
      testCode += '});\n\n';
    });

    return testCode;
  }

  /**
   * Execute tests from file path or test code with enhanced reliability
   */
  async executeTest(
    testPath: string, 
    options?: {
      browsers?: string[];
      reporter?: string;
      screenshots?: boolean;
      screenshotPath?: string;
      video?: boolean;
      videoPath?: string;
      concurrency?: number;
      speed?: number;
      timeout?: number;
      quarantine?: boolean;
      stopOnFirstFail?: boolean;
      retryAttempts?: number;
      filter?: {
        test?: string;
        fixture?: string;
        testGrep?: string;
        fixtureGrep?: string;
      };
    }
  ): Promise<TestExecutionResult> {
    const maxRetries = options?.retryAttempts ?? 2;
    let lastError: Error | null = null;
    
    // Try execution with retries for browser launch failures
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeTestAttempt(testPath, options, attempt);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if this is a retryable error
        if (attempt < maxRetries && this.isRetryableError(lastError)) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
          console.warn(`Test execution attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`);
          
          // Clean up TestCafe instance before retry
          await this.close();
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Non-retryable error or max retries reached
        break;
      }
    }
    
    // All attempts failed, return error result
    throw lastError || new Error('Test execution failed after all retry attempts');
  }

  /**
   * Single test execution attempt with enhanced error handling
   */
  private async executeTestAttempt(
    testPath: string,
    options: any,
    attemptNumber: number
  ): Promise<TestExecutionResult> {
    const executionStartTime = Date.now();
    const browserLaunchStartTime = Date.now();
    
    await this.initialize();
    
    if (!this.testCafe) {
      throw new Error('TestCafe not initialized');
    }

    const browserLaunchTime = Date.now() - browserLaunchStartTime;
    const browsers = options?.browsers || this.getBrowserStrings();
    const runner = this.testCafe.createRunner();

    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ testName: string; error: string; stack?: string }> = [];
    const warnings: string[] = [];
    const screenshots: string[] = [];
    const videos: string[] = [];
    const startTime = Date.now();

    // Add attempt info to warnings if this is a retry
    if (attemptNumber > 0) {
      warnings.push(`Execution attempt ${attemptNumber + 1} after ${attemptNumber} failed attempts`);
    }

    // Check system stress before execution
    if (performanceMonitor.isSystemUnderStress()) {
      warnings.push('System under stress - execution may be slower than usual');
    }

    try {
      // Configure runner with source files
      runner.src(testPath);
      
      // Enhanced browser configuration with validation
      const validatedBrowsers = await this.validateAndPrepareBrowsers(browsers);
      runner.browsers(validatedBrowsers);

      // Enhanced screenshot configuration
      if (options?.screenshots) {
        const screenshotConfig = await this.configureScreenshots(options.screenshotPath);
        runner.screenshots(screenshotConfig);
      }

      // Enhanced video recording configuration
      if (options?.video) {
        const videoConfig = await this.configureVideoRecording(options.videoPath);
        runner.video(videoConfig.path, videoConfig.options);
      }

      // Use dual reporter approach for better result collection
      let reportData = '';
      const reportPath = await this.createTempReportFile();
      
      runner.reporter([
        {
          name: 'json',
          output: reportPath
        },
        {
          name: 'spec',
          output: process.stdout
        }
      ]);

      // Apply filters if specified
      if (options?.filter) {
        if (options.filter.test) {
          runner.filter((testName: string) => testName.includes(options.filter!.test!));
        }
        if (options.filter.fixture) {
          runner.filter((testName: string, fixtureName: string) => 
            fixtureName.includes(options.filter!.fixture!)
          );
        }
        if (options.filter.testGrep) {
          runner.filter((testName: string) => 
            new RegExp(options.filter!.testGrep!).test(testName)
          );
        }
        if (options.filter.fixtureGrep) {
          runner.filter((testName: string, fixtureName: string) => 
            new RegExp(options.filter!.fixtureGrep!).test(fixtureName)
          );
        }
      }

      // Enhanced run options with better timeout management
      const runOptions = this.buildRunOptions(options);
      
      // Enhanced timeout configuration
      this.configureTimeouts(runOptions, options?.timeout);

      // Execute tests with enhanced error handling
      const failedTestCount = await runner.run(runOptions);
      const duration = Date.now() - startTime;

      // Read and parse the JSON report
      try {
        const fs = await import('fs/promises');
        reportData = await fs.readFile(reportPath, 'utf8');
        
        if (reportData.trim()) {
          const report = JSON.parse(reportData);
          
          // Enhanced result extraction
          const results = this.extractTestResults(report);
          passedCount = results.passed;
          failedCount = results.failed;
          skippedCount = results.skipped;
          errors.push(...results.errors);
          warnings.push(...results.warnings);
          screenshots.push(...results.screenshots);
          videos.push(...results.videos);
        }
        
        // Clean up temp report file
        await this.cleanupTempFile(reportPath);
      } catch (parseError) {
        warnings.push(`Failed to parse test report: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        // Fallback to basic counting
        failedCount = failedTestCount;
        if (failedTestCount === 0) {
          passedCount = 1; // Assume at least one test passed if none failed
        } else {
          passedCount = 0; // If tests failed, don't assume any passed
        }
      }

      // Record performance metrics
      const totalTests = passedCount + failedCount + skippedCount;
      const errorRate = totalTests > 0 ? failedCount / totalTests : 0;
      
      performanceMonitor.recordMetrics({
        testExecutionTime: duration,
        browserLaunchTime,
        testCount: totalTests,
        errorRate,
        timestamp: Date.now()
      });

      // Add performance recommendations to warnings if needed
      const suggestions = performanceMonitor.getOptimizationSuggestions();
      if (suggestions.length > 0 && duration > 30000) { // Only for long-running tests
        warnings.push(`Performance suggestions: ${suggestions.slice(0, 2).join(', ')}`);
      }

      return {
        success: failedCount === 0,
        passedCount,
        failedCount,
        skippedCount,
        duration,
        errors,
        warnings,
        screenshots: screenshots.length > 0 ? screenshots : undefined,
        videos: videos.length > 0 ? videos : undefined,
        reportPath: reportPath,
        metadata: {
          browserVersions: browsers,
          testEnvironment: process.env.NODE_ENV || 'development',
          executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          performanceMetrics: {
            browserLaunchTime,
            totalExecutionTime: Date.now() - executionStartTime,
            systemStress: performanceMonitor.isSystemUnderStress()
          }
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const totalExecutionTime = Date.now() - executionStartTime;
      
      // Record failed execution metrics
      performanceMonitor.recordMetrics({
        testExecutionTime: duration,
        browserLaunchTime,
        testCount: 1,
        errorRate: 1,
        timestamp: Date.now()
      });
      
      // Enhanced error categorization
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCategory = this.categorizeError(errorMessage);
      
      return {
        success: false,
        passedCount,
        failedCount: failedCount + 1,
        skippedCount,
        duration,
        errors: [{
          testName: errorCategory,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }],
        warnings,
        screenshots: screenshots.length > 0 ? screenshots : undefined,
        videos: videos.length > 0 ? videos : undefined,
        metadata: {
          browserVersions: browsers,
          testEnvironment: process.env.NODE_ENV || 'development',
          executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          performanceMetrics: {
            browserLaunchTime,
            totalExecutionTime,
            systemStress: performanceMonitor.isSystemUnderStress()
          }
        }
      };
    }
  }

  /**
   * Validate test structure
   */
  validateTestStructure(structure: unknown): TestValidationResult {
    try {
      TestStructureSchema.parse(structure);
      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        return {
          isValid: false,
          errors,
          warnings: []
        };
      }
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
    }
  }

  /**
   * Validate TestCafe syntax in test code
   */
  validateTestCode(testCode: string): TestValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic syntax validation
    if (!testCode.includes('fixture(')) {
      errors.push('Test code must contain at least one fixture');
    }

    if (!testCode.includes('test(')) {
      errors.push('Test code must contain at least one test');
    }

    // Check for common TestCafe patterns
    const requiredImports = ['Selector'];
    const hasImports = requiredImports.some(imp => 
      testCode.includes(`import { ${imp} }`) || testCode.includes(`import ${imp}`)
    );

    if (!hasImports && testCode.includes('Selector(')) {
      warnings.push('Consider importing Selector from testcafe for better type support');
    }

    // Check for async/await patterns
    const testMatches = testCode.match(/test\([^,]+,\s*([^=]+)=>/g);
    if (testMatches) {
      testMatches.forEach(match => {
        if (!match.includes('async')) {
          warnings.push('Test functions should be async when using TestCafe actions');
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get browser configuration as strings for TestCafe
   */
  private getBrowserStrings(): string[] {
    return this.config.browsers.map(browser => {
      let browserString = browser.name;
      
      if (browser.headless) {
        browserString += ':headless';
      }
      
      if (browser.args && browser.args.length > 0) {
        browserString += ` --${browser.args.join(' --')}`;
      }
      
      return browserString;
    });
  }

  /**
   * Generate TestCafe action code
   */
  private generateActionCode(action: any, indent: number): string {
    const spaces = ' '.repeat(indent);
    
    switch (action.type) {
      case 'navigate':
        return `${spaces}await t.navigateTo('${action.value}');\n`;
      
      case 'click':
        if (!action.selector) {
          throw new Error('Click action requires a selector');
        }
        return `${spaces}await t.click(Selector('${this.escapeString(action.selector)}'));\n`;
      
      case 'type':
        if (!action.selector || !action.value) {
          throw new Error('Type action requires selector and value');
        }
        return `${spaces}await t.typeText(Selector('${this.escapeString(action.selector)}'), '${this.escapeString(action.value)}');\n`;
      
      case 'wait':
        const timeout = action.timeout || 1000;
        return `${spaces}await t.wait(${timeout});\n`;
      
      case 'assert':
        if (!action.selector) {
          throw new Error('Assert action requires a selector');
        }
        return `${spaces}await t.expect(Selector('${this.escapeString(action.selector)}').exists).ok();\n`;
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Escape string for JavaScript code generation
   */
  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }

  /**
   * Format TestCafe callsite information for better error reporting
   */
  private formatCallsite(callsite: any): string {
    if (!callsite) return '';
    
    try {
      if (callsite.filename && callsite.lineNum) {
        let formatted = `${callsite.filename}:${callsite.lineNum}`;
        if (callsite.columnNum) {
          formatted += `:${callsite.columnNum}`;
        }
        if (callsite.source) {
          formatted += `\n${callsite.source}`;
        }
        return formatted;
      }
      
      // Fallback to string representation
      return String(callsite);
    } catch (error) {
      return 'Error formatting callsite information';
    }
  }

  /**
   * Create a temporary test file for execution
   */
  async createTempTestFile(testCode: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testcafe-mcp-'));
    const tempFile = path.join(tempDir, 'temp-test.js');
    
    await fs.writeFile(tempFile, testCode, 'utf8');
    return tempFile;
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Remove the file
      await fs.unlink(filePath);
      
      // Try to remove the directory if it's empty
      const dir = path.dirname(filePath);
      try {
        await fs.rmdir(dir);
      } catch {
        // Directory not empty or other error, ignore
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Execute test code directly (creates temporary file) with enhanced reliability
   */
  async executeTestCode(
    testCode: string,
    options?: {
      browsers?: string[];
      reporter?: string;
      screenshots?: boolean;
      screenshotPath?: string;
      video?: boolean;
      videoPath?: string;
      concurrency?: number;
      speed?: number;
      timeout?: number;
      quarantine?: boolean;
      stopOnFirstFail?: boolean;
      retryAttempts?: number;
    }
  ): Promise<TestExecutionResult> {
    let tempFile: string | null = null;
    
    try {
      // Validate test code first
      const validation = this.validateTestCode(testCode);
      if (!validation.isValid) {
        return {
          success: false,
          passedCount: 0,
          failedCount: 1,
          skippedCount: 0,
          duration: 0,
          errors: validation.errors.map(error => ({
            testName: 'Code Validation',
            error
          })),
          warnings: validation.warnings
        };
      }

      // Create temporary file
      tempFile = await this.createTempTestFile(testCode);
      
      // Execute the test
      const result = await this.executeTest(tempFile, options);
      
      // Add validation warnings to result
      if (validation.warnings.length > 0) {
        result.warnings = [...(result.warnings || []), ...validation.warnings];
      }
      
      return result;
    } finally {
      // Clean up temporary file
      if (tempFile) {
        await this.cleanupTempFile(tempFile);
      }
    }
  }

  /**
   * Ensure directory exists for screenshots/videos
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  /**
   * Create temporary report file
   */
  private async createTempReportFile(): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testcafe-report-'));
    return path.join(tempDir, 'report.json');
  }

  /**
   * Extract test results from TestCafe JSON report with enhanced parsing
   */
  private extractTestResults(report: any): {
    passed: number;
    failed: number;
    skipped: number;
    errors: Array<{ testName: string; error: string; stack?: string }>;
    warnings: string[];
    screenshots: string[];
    videos: string[];
  } {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: Array<{ testName: string; error: string; stack?: string }> = [];
    const warnings: string[] = [];
    const screenshots: string[] = [];
    const videos: string[] = [];

    try {
      // Handle different report formats
      if (report.fixtures && Array.isArray(report.fixtures)) {
        // Standard TestCafe JSON report format
        report.fixtures.forEach((fixture: any) => {
          if (fixture.tests && Array.isArray(fixture.tests)) {
            fixture.tests.forEach((test: any) => {
              const testName = `${fixture.name || 'Unknown Fixture'} > ${test.name || 'Unknown Test'}`;
              
              if (test.skipped) {
                skipped++;
              } else if (test.errs && test.errs.length > 0) {
                failed++;
                test.errs.forEach((err: any) => {
                  errors.push({
                    testName,
                    error: this.extractErrorMessage(err),
                    stack: this.extractCallsiteInfo(err)
                  });
                });
              } else {
                passed++;
              }

              // Enhanced screenshot collection
              this.collectScreenshots(test, screenshots, testName);
              
              // Enhanced video collection
              this.collectVideos(test, videos, testName);
            });
          }
        });
      } else if (report.total !== undefined) {
        // Alternative report format with totals
        passed = report.passed || 0;
        failed = report.failed || 0;
        skipped = report.skipped || 0;
        
        if (report.failures && Array.isArray(report.failures)) {
          report.failures.forEach((failure: any) => {
            errors.push({
              testName: failure.fullTitle || failure.title || 'Unknown Test',
              error: failure.err?.message || failure.message || 'Unknown error',
              stack: failure.err?.stack || failure.stack
            });
          });
        }
      } else if (Array.isArray(report)) {
        // Handle array format reports
        report.forEach((item: any) => {
          if (item.fixtures) {
            const subResult = this.extractTestResults(item);
            passed += subResult.passed;
            failed += subResult.failed;
            skipped += subResult.skipped;
            errors.push(...subResult.errors);
            warnings.push(...subResult.warnings);
            screenshots.push(...subResult.screenshots);
            videos.push(...subResult.videos);
          }
        });
      }

      // Extract global warnings from various locations
      this.extractWarnings(report, warnings);
      
      // Extract global screenshots and videos
      this.extractGlobalMedia(report, screenshots, videos);

    } catch (parseError) {
      warnings.push(`Error parsing test results: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    return { passed, failed, skipped, errors, warnings, screenshots, videos };
  }

  /**
   * Collect screenshots from test results with enhanced path handling
   */
  private collectScreenshots(test: any, screenshots: string[], testName: string): void {
    if (test.screenshots && Array.isArray(test.screenshots)) {
      test.screenshots.forEach((screenshot: any) => {
        if (screenshot.screenshotPath) {
          screenshots.push(screenshot.screenshotPath);
        } else if (screenshot.path) {
          screenshots.push(screenshot.path);
        } else if (typeof screenshot === 'string') {
          screenshots.push(screenshot);
        }
      });
    }
    
    // Check for screenshots in different locations
    if (test.screenshotPath) {
      screenshots.push(test.screenshotPath);
    }
    
    if (test.media && test.media.screenshots) {
      test.media.screenshots.forEach((path: string) => screenshots.push(path));
    }
  }

  /**
   * Collect videos from test results with enhanced path handling
   */
  private collectVideos(test: any, videos: string[], testName: string): void {
    if (test.videos && Array.isArray(test.videos)) {
      test.videos.forEach((video: any) => {
        if (video.videoPath) {
          videos.push(video.videoPath);
        } else if (video.path) {
          videos.push(video.path);
        } else if (typeof video === 'string') {
          videos.push(video);
        }
      });
    }
    
    // Check for videos in different locations
    if (test.videoPath) {
      videos.push(test.videoPath);
    }
    
    if (test.media && test.media.videos) {
      test.media.videos.forEach((path: string) => videos.push(path));
    }
  }

  /**
   * Extract warnings from various report locations
   */
  private extractWarnings(report: any, warnings: string[]): void {
    // Standard warnings array
    if (report.warnings && Array.isArray(report.warnings)) {
      warnings.push(...report.warnings.map((w: any) => typeof w === 'string' ? w : w.message || String(w)));
    }
    
    // Browser warnings
    if (report.browserWarnings && Array.isArray(report.browserWarnings)) {
      warnings.push(...report.browserWarnings.map((w: any) => `Browser: ${w.message || w}`));
    }
    
    // Deprecation warnings
    if (report.deprecationWarnings && Array.isArray(report.deprecationWarnings)) {
      warnings.push(...report.deprecationWarnings.map((w: any) => `Deprecated: ${w.message || w}`));
    }
  }

  /**
   * Extract global media files from report
   */
  private extractGlobalMedia(report: any, screenshots: string[], videos: string[]): void {
    // Global screenshots
    if (report.screenshots && Array.isArray(report.screenshots)) {
      screenshots.push(...report.screenshots.filter((s: any) => typeof s === 'string'));
    }
    
    // Global videos
    if (report.videos && Array.isArray(report.videos)) {
      videos.push(...report.videos.filter((v: any) => typeof v === 'string'));
    }
  }

  /**
   * Extract enhanced callsite information
   */
  private extractCallsiteInfo(err: any): string | undefined {
    if (err.callsite) {
      return this.formatCallsite(err.callsite);
    }
    
    if (err.stack) {
      return err.stack;
    }
    
    if (err.source && err.line) {
      return `${err.source}:${err.line}${err.column ? `:${err.column}` : ''}`;
    }
    
    return undefined;
  }

  /**
   * Extract error message from TestCafe error object
   */
  private extractErrorMessage(err: any): string {
    if (err.errMsg) return err.errMsg;
    if (err.message) return err.message;
    if (err.type && err.type === 'actionElementNotFoundError') {
      return `Element not found: ${err.selector || 'unknown selector'}`;
    }
    if (err.type && err.type === 'assertionError') {
      return `Assertion failed: ${err.actual} ${err.operator || '!=='} ${err.expected}`;
    }
    return err.toString() || 'Unknown error';
  }

  /**
   * Categorize error for better reporting
   */
  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('browser')) return 'Browser Launch Error';
    if (errorMessage.includes('timeout')) return 'Timeout Error';
    if (errorMessage.includes('selector')) return 'Selector Error';
    if (errorMessage.includes('network')) return 'Network Error';
    if (errorMessage.includes('syntax')) return 'Syntax Error';
    return 'Test Execution Error';
  }

  /**
   * Check if an error is retryable (browser launch failures, network issues, etc.)
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Browser launch failures
    if (message.includes('browser') && (
      message.includes('launch') || 
      message.includes('start') || 
      message.includes('connect') ||
      message.includes('timeout')
    )) {
      return true;
    }
    
    // Network-related errors
    if (message.includes('network') || 
        message.includes('connection') || 
        message.includes('econnrefused') ||
        message.includes('enotfound')) {
      return true;
    }
    
    // Port binding issues
    if (message.includes('port') && message.includes('use')) {
      return true;
    }
    
    // Temporary file system issues
    if (message.includes('enoent') || message.includes('eacces')) {
      return true;
    }
    
    return false;
  }

  /**
   * Validate and prepare browser configurations
   */
  private async validateAndPrepareBrowsers(browsers: string[]): Promise<string[]> {
    const validatedBrowsers: string[] = [];
    
    for (const browser of browsers) {
      try {
        // Basic browser string validation
        if (!browser || typeof browser !== 'string') {
          throw new Error(`Invalid browser configuration: ${browser}`);
        }
        
        // Parse browser string to validate format
        const browserParts = browser.split(':');
        const browserName = browserParts[0].toLowerCase();
        
        // Validate known browser names
        const knownBrowsers = ['chrome', 'firefox', 'safari', 'edge', 'chromium'];
        if (!knownBrowsers.includes(browserName)) {
          console.warn(`Unknown browser: ${browserName}, proceeding anyway`);
        }
        
        // Add enhanced browser options for reliability
        let enhancedBrowser = browser;
        
        // Add stability flags for Chrome/Chromium
        if (browserName.includes('chrome') || browserName.includes('chromium')) {
          if (!browser.includes('--disable-native-automation')) {
            enhancedBrowser += ' --disable-native-automation';
          }
          if (!browser.includes('--no-sandbox')) {
            enhancedBrowser += ' --no-sandbox';
          }
          if (!browser.includes('--disable-dev-shm-usage')) {
            enhancedBrowser += ' --disable-dev-shm-usage';
          }
          if (!browser.includes('--disable-gpu')) {
            enhancedBrowser += ' --disable-gpu';
          }
        }
        
        validatedBrowsers.push(enhancedBrowser);
      } catch (error) {
        console.warn(`Browser validation warning for ${browser}: ${error instanceof Error ? error.message : String(error)}`);
        // Still add the browser, let TestCafe handle the final validation
        validatedBrowsers.push(browser);
      }
    }
    
    return validatedBrowsers;
  }

  /**
   * Configure screenshots with enhanced options
   */
  private async configureScreenshots(screenshotPath?: string): Promise<any> {
    const path = screenshotPath || './screenshots';
    await this.ensureDirectoryExists(path);
    
    return {
      path,
      takeOnFails: true,
      fullPage: true,
      pathPattern: '${DATE}_${TIME}/test-${TEST_INDEX}/${USERAGENT}/${FILE_INDEX}.png',
      // Enhanced screenshot options
      thumbnails: false,
      mode: 'always', // Take screenshots for all tests, not just failures
      quality: 90,
      crop: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      }
    };
  }

  /**
   * Configure video recording with enhanced options
   */
  private async configureVideoRecording(videoPath?: string): Promise<{ path: string; options: any }> {
    const path = videoPath || './videos';
    await this.ensureDirectoryExists(path);
    
    return {
      path,
      options: {
        singleFile: false,
        failedOnly: false,
        pathPattern: '${DATE}_${TIME}/test-${TEST_INDEX}/${USERAGENT}/${FILE_INDEX}.mp4',
        // Enhanced video options
        ffmpegPath: undefined, // Use system ffmpeg
        encodingOptions: {
          r: 25, // Frame rate
          aspect: '16:9'
        }
      }
    };
  }

  /**
   * Build enhanced run options
   */
  private buildRunOptions(options: any): any {
    return {
      skipJsErrors: options?.quarantine ? false : (this.config.skipJsErrors ?? true),
      skipUncaughtErrors: this.config.skipUncaughtErrors ?? true,
      quarantineMode: options?.quarantine ?? this.config.quarantineMode ?? false,
      speed: options?.speed ?? this.config.speed ?? 1,
      stopOnFirstFail: options?.stopOnFirstFail ?? this.config.stopOnFirstFail ?? false,
      concurrency: options?.concurrency ?? this.config.concurrency ?? 1,
      debugMode: false,
      debugOnFail: false,
      // Enhanced reliability options
      disablePageCaching: true,
      disablePageReloads: false,
      compilerOptions: {
        typescript: {
          configPath: 'tsconfig.json',
          customCompilerModulePath: undefined
        }
      }
    };
  }

  /**
   * Configure comprehensive timeout settings
   */
  private configureTimeouts(runOptions: any, customTimeout?: number): void {
    const baseTimeout = customTimeout || this.config.timeout || 30000;
    
    // Set various timeout types with appropriate scaling
    runOptions.pageLoadTimeout = baseTimeout;
    runOptions.assertionTimeout = Math.min(baseTimeout, 10000); // Assertions shouldn't wait too long
    runOptions.selectorTimeout = Math.min(baseTimeout, 10000); // Element selection timeout
    runOptions.pageRequestTimeout = baseTimeout;
    runOptions.ajaxRequestTimeout = Math.min(baseTimeout, 15000); // AJAX requests
    
    // Browser-specific timeouts
    runOptions.browserInitTimeout = Math.max(baseTimeout, 60000); // Browser launch can take time
    runOptions.testExecutionTimeout = baseTimeout * 3; // Overall test timeout
    
    // Add timeout for specific operations
    runOptions.hooks = {
      testRun: {
        before: async () => {
          // Set up test-specific timeouts if needed
        }
      }
    };
  }
}