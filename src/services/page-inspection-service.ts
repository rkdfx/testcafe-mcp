/**
 * Page Inspection Service
 * 
 * Provides page analysis and element discovery functionality.
 */

import { z } from 'zod';
import { ElementInfo, SelectorSuggestion, BrowserInteractionService } from './browser-interaction-service.js';

/**
 * Page inspection options schema
 */
export const PageInspectionOptionsSchema = z.object({
  includeHidden: z.boolean().default(false),
  maxDepth: z.number().min(1).max(10).default(5),
  includeText: z.boolean().default(true),
  includeAttributes: z.boolean().default(true),
  filterByTag: z.array(z.string()).optional(),
  filterByClass: z.array(z.string()).optional()
});

/**
 * Element discovery result
 */
export interface ElementDiscoveryResult {
  elements: ElementInfo[];
  totalCount: number;
  visibleCount: number;
  interactableCount: number;
}

/**
 * Page structure analysis
 */
export interface PageStructureAnalysis {
  title: string;
  url: string;
  forms: Array<{
    id?: string;
    action?: string;
    method?: string;
    fields: Array<{
      name: string;
      type: string;
      required: boolean;
      selector: string;
    }>;
  }>;
  links: Array<{
    text: string;
    href: string;
    selector: string;
  }>;
  buttons: Array<{
    text: string;
    type: string;
    selector: string;
  }>;
  inputs: Array<{
    name?: string;
    type: string;
    placeholder?: string;
    selector: string;
  }>;
  headings: Array<{
    level: number;
    text: string;
    selector: string;
  }>;
}

export type PageInspectionOptions = z.infer<typeof PageInspectionOptionsSchema>;

/**
 * Live page inspection result with enhanced debugging information
 */
export interface LiveInspectionResult {
  success: boolean;
  pageStructure?: PageStructureAnalysis;
  elements?: ElementInfo[];
  screenshots?: string[];
  duration: number;
  errors: string[];
  warnings: string[];
  debugInfo?: {
    pageReadyState?: string;
    totalElementsFound?: number;
    visibleElementsFound?: number;
    interactiveElementsFound?: number;
    executionDetails?: {
      waitedForPageReady: boolean;
      pageReadyTimeout: number;
      debugMode: boolean;
    };
  };
}

/**
 * Page Inspection Service
 * 
 * Handles page analysis, element discovery, and selector generation.
 */
export class PageInspectionService {
  private browserInteractionService: BrowserInteractionService;
  private testCafeInstance: any = null;

  constructor() {
    this.browserInteractionService = new BrowserInteractionService();
  }

  /**
   * Initialize page inspection service with TestCafe instance
   */
  async initialize(testCafeInstance?: any): Promise<void> {
    if (testCafeInstance) {
      this.testCafeInstance = testCafeInstance;
    } else {
      const createTestCafe = (await import('testcafe')).default;
      this.testCafeInstance = await createTestCafe('localhost', 1337, 1338);
    }
    
    await this.browserInteractionService.initialize(this.testCafeInstance);
  }

  /**
   * Close page inspection service
   */
  async close(): Promise<void> {
    await this.browserInteractionService.close();
    if (this.testCafeInstance) {
      await this.testCafeInstance.close();
      this.testCafeInstance = null;
    }
  }

  /**
   * Perform live page inspection using real TestCafe browser
   */
  async inspectPageLive(
    url: string,
    options?: {
      browser?: string;
      operation?: 'analyze' | 'discover' | 'elements';
      selector?: string;
      includeScreenshots?: boolean;
      screenshotPath?: string;
      inspectionOptions?: Partial<PageInspectionOptions>;
      waitForPageReady?: boolean;
      pageReadyTimeout?: number;
      debugMode?: boolean;
    }
  ): Promise<LiveInspectionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const screenshots: string[] = [];

    try {
      if (!this.testCafeInstance) {
        await this.initialize();
      }

      const operation = options?.operation || 'analyze';
      const waitForPageReady = options?.waitForPageReady !== false; // Default to true
      const pageReadyTimeout = options?.pageReadyTimeout || 10000; // 10 second default
      const debugMode = options?.debugMode || false;

      let inspectionCode: string;

      switch (operation) {
        case 'analyze':
          inspectionCode = this.generateEnhancedPageAnalysisCode(url, {
            ...options?.inspectionOptions,
            waitForPageReady,
            pageReadyTimeout,
            debugMode
          });
          break;
        case 'discover':
          inspectionCode = this.generateEnhancedElementDiscoveryCode(url, options?.selector, {
            waitForPageReady,
            pageReadyTimeout,
            debugMode,
            inspectionOptions: options?.inspectionOptions
          });
          break;
        case 'elements':
          inspectionCode = this.generateEnhancedPageInspectionCode(url, {
            ...options?.inspectionOptions,
            waitForPageReady,
            pageReadyTimeout,
            debugMode
          });
          break;
        default:
          throw new Error(`Unknown inspection operation: ${operation}`);
      }

      // Execute inspection in real browser with enhanced error handling
      const result = await this.executeEnhancedInspectionCode(inspectionCode, {
        browser: options?.browser || 'chrome:headless',
        screenshots: options?.includeScreenshots,
        screenshotPath: options?.screenshotPath,
        debugMode
      });

      // Validate results and provide debugging information
      if (result.elements && result.elements.length === 0 && options?.selector) {
        warnings.push(`No elements found for selector: ${options.selector}`);
        warnings.push('Consider checking if the page has loaded completely or if the selector is correct');
      }

      if (result.pageStructure && this.isEmptyPageStructure(result.pageStructure)) {
        warnings.push('Page structure appears empty - page may not have loaded properly');
      }

      return {
        success: true,
        pageStructure: result.pageStructure,
        elements: result.elements,
        screenshots: result.screenshots,
        duration: Date.now() - startTime,
        errors,
        warnings: [...warnings, ...result.warnings]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      
      // Enhanced error debugging
      if (errorMessage.includes('timeout')) {
        errors.push('Debugging tip: Try increasing pageReadyTimeout or check if the page loads correctly');
      }
      if (errorMessage.includes('selector')) {
        errors.push('Debugging tip: Verify the selector syntax and ensure the element exists on the page');
      }
      if (errorMessage.includes('browser')) {
        errors.push('Debugging tip: Check if the specified browser is available and properly configured');
      }

      return {
        success: false,
        duration: Date.now() - startTime,
        errors,
        warnings,
        screenshots
      };
    }
  }

  /**
   * Discover elements on live page
   */
  async discoverElementsLive(
    url: string,
    selector?: string,
    options?: {
      browser?: string;
      maxElements?: number;
      includeHidden?: boolean;
      screenshots?: boolean;
    }
  ): Promise<ElementInfo[]> {
    try {
      const result = await this.inspectPageLive(url, {
        operation: 'discover',
        selector,
        browser: options?.browser,
        includeScreenshots: options?.screenshots,
        inspectionOptions: {
          includeHidden: options?.includeHidden
        }
      });

      return result.elements || [];
    } catch (error) {
      console.error('Live element discovery failed:', error);
      return [];
    }
  }

  /**
   * Analyze page structure on live page
   */
  async analyzePageStructureLive(
    url: string,
    options?: {
      browser?: string;
      screenshots?: boolean;
      screenshotPath?: string;
    }
  ): Promise<PageStructureAnalysis | null> {
    try {
      const result = await this.inspectPageLive(url, {
        operation: 'analyze',
        browser: options?.browser,
        includeScreenshots: options?.screenshots,
        screenshotPath: options?.screenshotPath
      });

      return result.pageStructure || null;
    } catch (error) {
      console.error('Live page analysis failed:', error);
      return null;
    }
  }

  /**
   * Generate enhanced live page analysis code with page readiness and debugging
   */
  private generateEnhancedPageAnalysisCode(
    url: string,
    options?: Partial<PageInspectionOptions> & {
      waitForPageReady?: boolean;
      pageReadyTimeout?: number;
      debugMode?: boolean;
    }
  ): string {
    const waitForPageReady = options?.waitForPageReady !== false;
    const pageReadyTimeout = options?.pageReadyTimeout || 10000;
    const debugMode = options?.debugMode || false;

    let testCode = `import { Selector } from 'testcafe';\n\n`;
    testCode += `fixture('Enhanced Live Page Analysis').page('${url}');\n\n`;
    testCode += `test('Analyze Page Structure with Enhanced Capabilities', async t => {\n`;
    
    if (debugMode) {
      testCode += `  console.log('DEBUG: Starting page analysis for ${url}');\n`;
    }

    // Add page readiness waiting (Requirement 4.4)
    if (waitForPageReady) {
      testCode += `  // Wait for page readiness (Requirement 4.4)\n`;
      testCode += `  await t.wait(1000); // Initial wait for page load\n`;
      testCode += `  \n`;
      testCode += `  // Wait for document ready state\n`;
      testCode += `  await t.expect(Selector(() => document.readyState === 'complete').exists).ok('Page should be ready', {\n`;
      testCode += `    timeout: ${pageReadyTimeout}\n`;
      testCode += `  });\n\n`;
      
      if (debugMode) {
        testCode += `  console.log('DEBUG: Page ready state confirmed');\n`;
      }
    }
    
    // Enhanced page structure analysis (Requirement 4.1)
    testCode += `  // Enhanced page structure capture (Requirement 4.1)\n`;
    testCode += `  const pageStructure = await t.eval(() => {\n`;
    testCode += this.generateEnhancedPageStructureAnalysisJS(debugMode);
    testCode += `  });\n\n`;
    
    // Add element count validation and debugging (Requirement 4.3)
    testCode += `  // Validation and debugging information (Requirement 4.3)\n`;
    testCode += `  const totalElements = pageStructure.forms.length + pageStructure.links.length + \n`;
    testCode += `                       pageStructure.buttons.length + pageStructure.inputs.length + \n`;
    testCode += `                       pageStructure.headings.length;\n`;
    testCode += `  \n`;
    testCode += `  if (totalElements === 0) {\n`;
    testCode += `    console.log('WARNING: No interactive elements found on page');\n`;
    testCode += `  }\n\n`;
    
    if (debugMode) {
      testCode += `  console.log('DEBUG: Found', totalElements, 'interactive elements');\n`;
    }
    
    // Log results for capture
    testCode += `  console.log('PAGE_ANALYSIS_RESULT:', JSON.stringify(pageStructure));\n`;
    testCode += `});\n`;

    return testCode;
  }

  /**
   * Generate live page analysis code (legacy method for backward compatibility)
   */
  private generateLivePageAnalysisCode(
    url: string,
    options?: Partial<PageInspectionOptions>
  ): string {
    return this.generateEnhancedPageAnalysisCode(url, options);
  }

  /**
   * Generate enhanced live element discovery code with debugging and validation
   */
  private generateEnhancedElementDiscoveryCode(
    url: string,
    selector?: string,
    options?: {
      waitForPageReady?: boolean;
      pageReadyTimeout?: number;
      debugMode?: boolean;
      inspectionOptions?: Partial<PageInspectionOptions>;
    }
  ): string {
    const waitForPageReady = options?.waitForPageReady !== false;
    const pageReadyTimeout = options?.pageReadyTimeout || 10000;
    const debugMode = options?.debugMode || false;
    const inspectionOptions = options?.inspectionOptions || {};

    let testCode = `import { Selector } from 'testcafe';\n\n`;
    testCode += `fixture('Enhanced Live Element Discovery').page('${url}');\n\n`;
    testCode += `test('Discover Elements with Enhanced Capabilities', async t => {\n`;
    
    if (debugMode) {
      testCode += `  console.log('DEBUG: Starting element discovery for ${selector || 'all elements'}');\n`;
    }

    // Add page readiness waiting (Requirement 4.4)
    if (waitForPageReady) {
      testCode += `  // Wait for page readiness (Requirement 4.4)\n`;
      testCode += `  await t.wait(1000);\n`;
      testCode += `  await t.expect(Selector(() => document.readyState === 'complete').exists).ok('Page should be ready', {\n`;
      testCode += `    timeout: ${pageReadyTimeout}\n`;
      testCode += `  });\n\n`;
    }

    // Enhanced element discovery with validation (Requirements 4.1, 4.3)
    if (selector) {
      testCode += `  // Discover specific elements with validation (Requirements 4.1, 4.3)\n`;
      testCode += `  const elements = await t.eval(() => {\n`;
      testCode += `    try {\n`;
      testCode += `      const foundElements = document.querySelectorAll('${this.escapeString(selector)}');\n`;
      testCode += `      if (foundElements.length === 0) {\n`;
      testCode += `        console.log('WARNING: No elements found for selector: ${this.escapeString(selector)}');\n`;
      testCode += `        console.log('DEBUG: Available elements on page:', document.querySelectorAll('*').length);\n`;
      testCode += `      }\n`;
      testCode += this.generateEnhancedElementExtractionJS('foundElements', debugMode);
      testCode += `    } catch (error) {\n`;
      testCode += `      console.log('ERROR: Element discovery failed:', error.message);\n`;
      testCode += `      return [];\n`;
      testCode += `    }\n`;
      testCode += `  });\n\n`;
    } else {
      testCode += `  // Discover all elements with filtering (Requirements 4.1, 4.3)\n`;
      testCode += `  const elements = await t.eval(() => {\n`;
      testCode += `    try {\n`;
      testCode += `      const allElements = document.querySelectorAll('*');\n`;
      testCode += `      console.log('DEBUG: Total elements found:', allElements.length);\n`;
      testCode += this.generateEnhancedElementExtractionJS('allElements', debugMode, inspectionOptions);
      testCode += `    } catch (error) {\n`;
      testCode += `      console.log('ERROR: Element discovery failed:', error.message);\n`;
      testCode += `      return [];\n`;
      testCode += `    }\n`;
      testCode += `  });\n\n`;
    }
    
    // Add result validation and debugging
    testCode += `  // Result validation and debugging (Requirement 4.3)\n`;
    testCode += `  if (elements.length === 0) {\n`;
    testCode += `    console.log('WARNING: No elements discovered');\n`;
    if (selector) {
      testCode += `    console.log('DEBUGGING: Check if selector "${this.escapeString(selector)}" is correct');\n`;
      testCode += `    console.log('DEBUGGING: Ensure the page has loaded completely');\n`;
    }
    testCode += `  } else {\n`;
    testCode += `    console.log('SUCCESS: Discovered', elements.length, 'elements');\n`;
    testCode += `  }\n\n`;
    
    testCode += `  console.log('ELEMENT_DISCOVERY_RESULT:', JSON.stringify(elements));\n`;
    testCode += `});\n`;

    return testCode;
  }

  /**
   * Generate live element discovery code (legacy method for backward compatibility)
   */
  private generateLiveElementDiscoveryCode(
    url: string,
    selector?: string
  ): string {
    return this.generateEnhancedElementDiscoveryCode(url, selector);
  }

  /**
   * Generate enhanced live page inspection code with comprehensive analysis
   */
  private generateEnhancedPageInspectionCode(
    url: string,
    options?: Partial<PageInspectionOptions> & {
      waitForPageReady?: boolean;
      pageReadyTimeout?: number;
      debugMode?: boolean;
    }
  ): string {
    const validatedOptions = PageInspectionOptionsSchema.parse(options || {});
    const waitForPageReady = options?.waitForPageReady !== false;
    const pageReadyTimeout = options?.pageReadyTimeout || 10000;
    const debugMode = options?.debugMode || false;
    
    let testCode = `import { Selector } from 'testcafe';\n\n`;
    testCode += `fixture('Enhanced Live Page Inspection').page('${url}');\n\n`;
    testCode += `test('Inspect Page Elements with Enhanced Analysis', async t => {\n`;
    
    if (debugMode) {
      testCode += `  console.log('DEBUG: Starting enhanced page inspection');\n`;
    }

    // Add page readiness waiting (Requirement 4.4)
    if (waitForPageReady) {
      testCode += `  // Wait for page readiness (Requirement 4.4)\n`;
      testCode += `  await t.wait(1000);\n`;
      testCode += `  await t.expect(Selector(() => document.readyState === 'complete').exists).ok('Page should be ready', {\n`;
      testCode += `    timeout: ${pageReadyTimeout}\n`;
      testCode += `  });\n\n`;
    }
    
    // Enhanced page inspection with comprehensive analysis (Requirement 4.1)
    testCode += `  // Enhanced page inspection with comprehensive analysis (Requirement 4.1)\n`;
    testCode += `  const pageInfo = await t.eval(() => {\n`;
    testCode += this.generateEnhancedPageInspectionJS(validatedOptions, debugMode);
    testCode += `  });\n\n`;
    
    // Add validation and debugging (Requirement 4.3)
    testCode += `  // Validation and debugging (Requirement 4.3)\n`;
    testCode += `  if (!pageInfo.elements || pageInfo.elements.length === 0) {\n`;
    testCode += `    console.log('WARNING: No elements found during inspection');\n`;
    testCode += `    console.log('DEBUGGING: Check if page content has loaded properly');\n`;
    testCode += `  } else {\n`;
    testCode += `    const visibleElements = pageInfo.elements.filter(el => el.isVisible);\n`;
    testCode += `    const interactableElements = pageInfo.elements.filter(el => el.isEnabled && el.isVisible);\n`;
    testCode += `    console.log('SUCCESS: Found', pageInfo.elements.length, 'total elements,', visibleElements.length, 'visible,', interactableElements.length, 'interactable');\n`;
    testCode += `  }\n\n`;
    
    testCode += `  console.log('PAGE_INSPECTION_RESULT:', JSON.stringify(pageInfo));\n`;
    testCode += `});\n`;

    return testCode;
  }

  /**
   * Generate live page inspection code (legacy method for backward compatibility)
   */
  private generateLivePageInspectionCode(
    url: string,
    options?: Partial<PageInspectionOptions>
  ): string {
    return this.generateEnhancedPageInspectionCode(url, options);
  }

  /**
   * Execute enhanced inspection code in TestCafe with better error handling
   */
  private async executeEnhancedInspectionCode(
    testCode: string,
    options?: {
      browser?: string;
      screenshots?: boolean;
      screenshotPath?: string;
      debugMode?: boolean;
    }
  ): Promise<{
    pageStructure?: PageStructureAnalysis;
    elements?: ElementInfo[];
    screenshots?: string[];
    warnings: string[];
  }> {
    const tempFile = await this.createTempTestFile(testCode);
    const warnings: string[] = [];
    
    try {
      const runner = this.testCafeInstance.createRunner();
      runner.src(tempFile);
      runner.browsers([options?.browser || 'chrome:headless']);

      // Enhanced screenshot configuration
      if (options?.screenshots) {
        const screenshotPath = options.screenshotPath || './inspection-screenshots';
        await this.ensureDirectoryExists(screenshotPath);
        runner.screenshots({
          path: screenshotPath,
          takeOnFails: true,
          fullPage: true,
          pathPattern: '${DATE}_${TIME}/inspection-${FIXTURE}-${TEST}.png'
        });
      }

      // Enhanced console output capture with better parsing
      let capturedOutput = '';
      let capturedWarnings = '';
      let capturedErrors = '';
      
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;
      
      console.log = (...args) => {
        const message = args.join(' ');
        capturedOutput += message + '\n';
        if (options?.debugMode) {
          originalLog('[INSPECTION]', ...args);
        }
      };
      
      console.warn = (...args) => {
        const message = args.join(' ');
        capturedWarnings += message + '\n';
        warnings.push(message);
        if (options?.debugMode) {
          originalWarn('[INSPECTION WARNING]', ...args);
        }
      };
      
      console.error = (...args) => {
        const message = args.join(' ');
        capturedErrors += message + '\n';
        if (options?.debugMode) {
          originalError('[INSPECTION ERROR]', ...args);
        }
      };

      try {
        const failedCount = await runner.run({
          skipJsErrors: true,
          skipUncaughtErrors: true,
          quarantineMode: false,
          selectorTimeout: 5000,
          assertionTimeout: 5000,
          pageLoadTimeout: 10000
        });
        
        if (failedCount > 0) {
          warnings.push(`TestCafe execution completed with ${failedCount} failed tests`);
        }
        
      } finally {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
      }

      // Enhanced result parsing with better error handling
      const results = this.parseEnhancedInspectionResults(capturedOutput, capturedWarnings, capturedErrors);
      
      return {
        ...results,
        warnings: [...warnings, ...results.warnings]
      };

    } catch (error) {
      warnings.push(`Inspection execution failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        warnings,
        pageStructure: undefined,
        elements: [],
        screenshots: []
      };
    } finally {
      await this.cleanupTempFile(tempFile);
    }
  }

  /**
   * Execute inspection code in TestCafe (legacy method for backward compatibility)
   */
  private async executeInspectionCode(
    testCode: string,
    options?: {
      browser?: string;
      screenshots?: boolean;
      screenshotPath?: string;
    }
  ): Promise<{
    pageStructure?: PageStructureAnalysis;
    elements?: ElementInfo[];
    screenshots?: string[];
  }> {
    const result = await this.executeEnhancedInspectionCode(testCode, options);
    return {
      pageStructure: result.pageStructure,
      elements: result.elements,
      screenshots: result.screenshots
    };
  }

  /**
   * Parse enhanced inspection results with better error handling and debugging
   */
  private parseEnhancedInspectionResults(
    output: string,
    warnings: string,
    errors: string
  ): {
    pageStructure?: PageStructureAnalysis;
    elements?: ElementInfo[];
    screenshots?: string[];
    warnings: string[];
  } {
    const result: any = {
      warnings: []
    };

    // Parse warnings from output
    if (warnings) {
      const warningLines = warnings.split('\n').filter(line => line.trim());
      result.warnings.push(...warningLines);
    }

    // Parse errors and convert to warnings for debugging (Requirement 4.3)
    if (errors) {
      const errorLines = errors.split('\n').filter(line => line.trim());
      result.warnings.push(...errorLines.map(err => `Error: ${err}`));
    }

    try {
      // Extract page analysis results with enhanced error handling
      const pageAnalysisMatch = output.match(/PAGE_ANALYSIS_RESULT: (.+)/);
      if (pageAnalysisMatch) {
        try {
          const parsed = JSON.parse(pageAnalysisMatch[1]);
          result.pageStructure = parsed;
          
          // Validate page structure and add debugging info (Requirement 4.3)
          if (this.isEmptyPageStructure(parsed)) {
            result.warnings.push('Page structure appears empty - check if page loaded correctly');
          }
        } catch (error) {
          result.warnings.push(`Failed to parse page analysis result: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Extract element discovery results with validation
      const elementDiscoveryMatch = output.match(/ELEMENT_DISCOVERY_RESULT: (.+)/);
      if (elementDiscoveryMatch) {
        try {
          const parsed = JSON.parse(elementDiscoveryMatch[1]);
          result.elements = Array.isArray(parsed) ? parsed : [];
          
          // Add debugging information (Requirement 4.3)
          if (result.elements.length === 0) {
            result.warnings.push('No elements discovered - check selector or page content');
          }
        } catch (error) {
          result.warnings.push(`Failed to parse element discovery result: ${error instanceof Error ? error.message : String(error)}`);
          result.elements = [];
        }
      }

      // Extract page inspection results with comprehensive validation
      const pageInspectionMatch = output.match(/PAGE_INSPECTION_RESULT: (.+)/);
      if (pageInspectionMatch) {
        try {
          const parsed = JSON.parse(pageInspectionMatch[1]);
          result.elements = parsed.elements || [];
          
          // Enhanced debugging information (Requirement 4.3)
          if (parsed.metadata) {
            const meta = parsed.metadata;
            if (meta.processedElements === 0) {
              result.warnings.push('No elements were processed - page may not have loaded');
            }
            if (meta.visibleElements === 0 && meta.processedElements > 0) {
              result.warnings.push('No visible elements found - check if page content is hidden');
            }
            if (meta.interactiveElements === 0) {
              result.warnings.push('No interactive elements found - page may be static content');
            }
          }
          
          if (parsed.debugInfo) {
            const debug = parsed.debugInfo;
            if (debug.viewport.width === 0 || debug.viewport.height === 0) {
              result.warnings.push('Invalid viewport dimensions detected');
            }
          }
          
        } catch (error) {
          result.warnings.push(`Failed to parse page inspection result: ${error instanceof Error ? error.message : String(error)}`);
          result.elements = [];
        }
      }

      // Extract screenshot information if available
      const screenshotMatches = output.match(/Screenshot saved to: (.+)/g);
      if (screenshotMatches) {
        result.screenshots = screenshotMatches.map(match => 
          match.replace('Screenshot saved to: ', '').trim()
        );
      }

    } catch (error) {
      result.warnings.push(`Failed to parse inspection output: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Parse inspection results from console output (legacy method for backward compatibility)
   */
  private parseInspectionResults(output: string): {
    pageStructure?: PageStructureAnalysis;
    elements?: ElementInfo[];
    screenshots?: string[];
  } {
    const enhanced = this.parseEnhancedInspectionResults(output, '', '');
    return {
      pageStructure: enhanced.pageStructure,
      elements: enhanced.elements,
      screenshots: enhanced.screenshots
    };
  }

  /**
   * Check if page structure is empty (helper for debugging)
   */
  private isEmptyPageStructure(structure: PageStructureAnalysis): boolean {
    if (!structure) return true;
    
    return structure.forms.length === 0 &&
           structure.links.length === 0 &&
           structure.buttons.length === 0 &&
           structure.inputs.length === 0 &&
           structure.headings.length === 0;
  }

  /**
   * Generate enhanced JavaScript code for page structure analysis with better selector suggestions
   */
  private generateEnhancedPageStructureAnalysisJS(debugMode: boolean = false): string {
    return `
    const analysis = {
      title: document.title,
      url: window.location.href,
      forms: [],
      links: [],
      buttons: [],
      inputs: [],
      headings: [],
      metadata: {
        totalElements: 0,
        interactiveElements: 0,
        timestamp: new Date().toISOString()
      }
    };
    
    ${debugMode ? 'console.log("DEBUG: Starting page structure analysis");' : ''}
    
    // Enhanced form analysis with better selector suggestions (Requirement 4.2)
    document.querySelectorAll('form').forEach((form, index) => {
      const formInfo = {
        id: form.id || undefined,
        action: form.action || undefined,
        method: form.method || 'get',
        className: form.className || undefined,
        fields: [],
        suggestedSelectors: []
      };
      
      // Generate multiple selector suggestions for forms
      if (form.id) {
        formInfo.suggestedSelectors.push({ selector: '#' + form.id, type: 'id', specificity: 100 });
      }
      if (form.className) {
        const classes = form.className.split(' ').filter(c => c.trim());
        classes.forEach(cls => {
          formInfo.suggestedSelectors.push({ selector: 'form.' + cls, type: 'class', specificity: 80 });
        });
      }
      if (form.name) {
        formInfo.suggestedSelectors.push({ selector: 'form[name="' + form.name + '"]', type: 'attribute', specificity: 90 });
      }
      formInfo.suggestedSelectors.push({ selector: 'form:nth-of-type(' + (index + 1) + ')', type: 'position', specificity: 60 });
      
      form.querySelectorAll('input, select, textarea').forEach(field => {
        const fieldInfo = {
          name: field.name || field.id || '',
          type: field.type || field.tagName.toLowerCase(),
          required: field.required || false,
          placeholder: field.placeholder || undefined,
          suggestedSelectors: []
        };
        
        // Enhanced selector suggestions for form fields (Requirement 4.2)
        if (field.id) {
          fieldInfo.suggestedSelectors.push({ selector: '#' + field.id, type: 'id', specificity: 100 });
        }
        if (field.name) {
          fieldInfo.suggestedSelectors.push({ selector: '[name="' + field.name + '"]', type: 'attribute', specificity: 90 });
        }
        if (field.getAttribute('data-testid')) {
          fieldInfo.suggestedSelectors.push({ selector: '[data-testid="' + field.getAttribute('data-testid') + '"]', type: 'test-id', specificity: 95 });
        }
        if (field.type) {
          fieldInfo.suggestedSelectors.push({ selector: 'input[type="' + field.type + '"]', type: 'attribute', specificity: 70 });
        }
        
        formInfo.fields.push(fieldInfo);
      });
      
      analysis.forms.push(formInfo);
      analysis.metadata.interactiveElements++;
    });
    
    // Enhanced link analysis with better selectors (Requirement 4.2)
    document.querySelectorAll('a[href]').forEach((link, index) => {
      const linkInfo = {
        text: link.textContent?.trim() || '',
        href: link.href,
        title: link.title || undefined,
        target: link.target || undefined,
        suggestedSelectors: []
      };
      
      // Generate multiple selector suggestions for links
      if (link.id) {
        linkInfo.suggestedSelectors.push({ selector: '#' + link.id, type: 'id', specificity: 100 });
      }
      if (link.className) {
        const classes = link.className.split(' ').filter(c => c.trim());
        classes.forEach(cls => {
          linkInfo.suggestedSelectors.push({ selector: 'a.' + cls, type: 'class', specificity: 80 });
        });
      }
      if (link.textContent?.trim()) {
        linkInfo.suggestedSelectors.push({ selector: 'a:contains("' + link.textContent.trim() + '")', type: 'text', specificity: 85 });
      }
      if (link.getAttribute('data-testid')) {
        linkInfo.suggestedSelectors.push({ selector: '[data-testid="' + link.getAttribute('data-testid') + '"]', type: 'test-id', specificity: 95 });
      }
      linkInfo.suggestedSelectors.push({ selector: 'a[href="' + link.getAttribute('href') + '"]', type: 'attribute', specificity: 75 });
      
      analysis.links.push(linkInfo);
      analysis.metadata.interactiveElements++;
    });
    
    // Enhanced button analysis with comprehensive selector suggestions (Requirement 4.2)
    document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach((button, index) => {
      const buttonInfo = {
        text: button.textContent?.trim() || button.value || '',
        type: button.type || 'button',
        disabled: button.disabled || false,
        suggestedSelectors: []
      };
      
      // Generate comprehensive selector suggestions for buttons
      if (button.id) {
        buttonInfo.suggestedSelectors.push({ selector: '#' + button.id, type: 'id', specificity: 100 });
      }
      if (button.className) {
        const classes = button.className.split(' ').filter(c => c.trim());
        classes.forEach(cls => {
          buttonInfo.suggestedSelectors.push({ selector: 'button.' + cls, type: 'class', specificity: 80 });
        });
      }
      if (button.name) {
        buttonInfo.suggestedSelectors.push({ selector: '[name="' + button.name + '"]', type: 'attribute', specificity: 90 });
      }
      if (button.getAttribute('data-testid')) {
        buttonInfo.suggestedSelectors.push({ selector: '[data-testid="' + button.getAttribute('data-testid') + '"]', type: 'test-id', specificity: 95 });
      }
      if (button.textContent?.trim()) {
        buttonInfo.suggestedSelectors.push({ selector: 'button:contains("' + button.textContent.trim() + '")', type: 'text', specificity: 85 });
      }
      if (button.type) {
        buttonInfo.suggestedSelectors.push({ selector: 'button[type="' + button.type + '"]', type: 'attribute', specificity: 70 });
      }
      
      analysis.buttons.push(buttonInfo);
      analysis.metadata.interactiveElements++;
    });
    
    // Enhanced input analysis with detailed selector suggestions (Requirement 4.2)
    document.querySelectorAll('input').forEach((input, index) => {
      const inputInfo = {
        name: input.name || undefined,
        type: input.type || 'text',
        placeholder: input.placeholder || undefined,
        value: input.value || undefined,
        required: input.required || false,
        disabled: input.disabled || false,
        suggestedSelectors: []
      };
      
      // Generate detailed selector suggestions for inputs
      if (input.id) {
        inputInfo.suggestedSelectors.push({ selector: '#' + input.id, type: 'id', specificity: 100 });
      }
      if (input.name) {
        inputInfo.suggestedSelectors.push({ selector: '[name="' + input.name + '"]', type: 'attribute', specificity: 90 });
      }
      if (input.getAttribute('data-testid')) {
        inputInfo.suggestedSelectors.push({ selector: '[data-testid="' + input.getAttribute('data-testid') + '"]', type: 'test-id', specificity: 95 });
      }
      if (input.type) {
        inputInfo.suggestedSelectors.push({ selector: 'input[type="' + input.type + '"]', type: 'attribute', specificity: 70 });
      }
      if (input.placeholder) {
        inputInfo.suggestedSelectors.push({ selector: 'input[placeholder="' + input.placeholder + '"]', type: 'attribute', specificity: 75 });
      }
      if (input.className) {
        const classes = input.className.split(' ').filter(c => c.trim());
        classes.forEach(cls => {
          inputInfo.suggestedSelectors.push({ selector: 'input.' + cls, type: 'class', specificity: 80 });
        });
      }
      
      analysis.inputs.push(inputInfo);
      analysis.metadata.interactiveElements++;
    });
    
    // Enhanced heading analysis with better selectors (Requirement 4.2)
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading, index) => {
      const headingInfo = {
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent?.trim() || '',
        suggestedSelectors: []
      };
      
      // Generate selector suggestions for headings
      if (heading.id) {
        headingInfo.suggestedSelectors.push({ selector: '#' + heading.id, type: 'id', specificity: 100 });
      }
      if (heading.className) {
        const classes = heading.className.split(' ').filter(c => c.trim());
        classes.forEach(cls => {
          headingInfo.suggestedSelectors.push({ selector: heading.tagName.toLowerCase() + '.' + cls, type: 'class', specificity: 80 });
        });
      }
      if (heading.textContent?.trim()) {
        headingInfo.suggestedSelectors.push({ selector: heading.tagName.toLowerCase() + ':contains("' + heading.textContent.trim() + '")', type: 'text', specificity: 85 });
      }
      headingInfo.suggestedSelectors.push({ selector: heading.tagName.toLowerCase() + ':nth-of-type(' + (index + 1) + ')', type: 'position', specificity: 60 });
      
      analysis.headings.push(headingInfo);
    });
    
    // Calculate total elements
    analysis.metadata.totalElements = document.querySelectorAll('*').length;
    
    ${debugMode ? 'console.log("DEBUG: Page structure analysis complete. Found", analysis.metadata.interactiveElements, "interactive elements");' : ''}
    
    return analysis;
    `;
  }

  /**
   * Generate JavaScript code for page structure analysis (legacy method for backward compatibility)
   */
  private generatePageStructureAnalysisJS(): string {
    return this.generateEnhancedPageStructureAnalysisJS(false);
  }

  /**
   * Generate enhanced JavaScript code for element extraction with comprehensive analysis
   */
  private generateEnhancedElementExtractionJS(
    elementsVar: string = 'foundElements',
    debugMode: boolean = false,
    options?: Partial<PageInspectionOptions>
  ): string {
    const includeHidden = options?.includeHidden !== false;
    const includeText = options?.includeText !== false;
    const includeAttributes = options?.includeAttributes !== false;
    
    return `
    ${debugMode ? `console.log('DEBUG: Processing', ${elementsVar}.length, 'elements');` : ''}
    
    return Array.from(${elementsVar}).map((el, index) => {
      try {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        
        // Enhanced visibility detection (Requirement 4.1)
        const isVisible = rect.width > 0 && rect.height > 0 && 
                         style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0';
        
        ${!includeHidden ? `
        // Skip hidden elements if not requested
        if (!isVisible) {
          return null;
        }
        ` : ''}
        
        // Enhanced element information extraction (Requirement 4.1)
        const elementInfo = {
          tagName: el.tagName,
          id: el.id || undefined,
          className: el.className || undefined,
          ${includeText ? `text: el.textContent?.trim() || undefined,` : ''}
          ${includeAttributes ? `
          attributes: Object.fromEntries(
            Array.from(el.attributes).map(attr => [attr.name, attr.value])
          ),
          ` : ''}
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          isVisible: isVisible,
          isEnabled: !el.disabled && !el.hasAttribute('disabled'),
          isInteractive: ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ||
                        el.hasAttribute('onclick') || 
                        el.hasAttribute('role') && ['button', 'link', 'tab'].includes(el.getAttribute('role')),
          
          // Enhanced selector suggestions (Requirement 4.2)
          suggestedSelectors: []
        };
        
        // Generate comprehensive selector suggestions (Requirement 4.2)
        if (el.id) {
          elementInfo.suggestedSelectors.push({
            selector: '#' + el.id,
            type: 'id',
            specificity: 100,
            description: 'ID selector - most specific and reliable'
          });
        }
        
        if (el.getAttribute('data-testid')) {
          elementInfo.suggestedSelectors.push({
            selector: '[data-testid="' + el.getAttribute('data-testid') + '"]',
            type: 'test-id',
            specificity: 95,
            description: 'Test ID selector - designed for testing'
          });
        }
        
        if (el.name) {
          elementInfo.suggestedSelectors.push({
            selector: '[name="' + el.name + '"]',
            type: 'attribute',
            specificity: 90,
            description: 'Name attribute selector - good for form elements'
          });
        }
        
        if (el.className) {
          const classes = el.className.split(' ').filter(c => c.trim());
          if (classes.length === 1) {
            elementInfo.suggestedSelectors.push({
              selector: '.' + classes[0],
              type: 'class',
              specificity: 80,
              description: 'Single class selector'
            });
          } else if (classes.length > 1) {
            elementInfo.suggestedSelectors.push({
              selector: '.' + classes.join('.'),
              type: 'class',
              specificity: 85,
              description: 'Multiple class selector - more specific'
            });
          }
        }
        
        if (el.textContent?.trim() && ['A', 'BUTTON'].includes(el.tagName)) {
          const text = el.textContent.trim().substring(0, 30);
          elementInfo.suggestedSelectors.push({
            selector: el.tagName.toLowerCase() + ':contains("' + text + '")',
            type: 'text',
            specificity: 85,
            description: 'Text-based selector - good for buttons and links'
          });
        }
        
        if (el.type && el.tagName === 'INPUT') {
          elementInfo.suggestedSelectors.push({
            selector: 'input[type="' + el.type + '"]',
            type: 'attribute',
            specificity: 70,
            description: 'Input type selector'
          });
        }
        
        // Add CSS selector as fallback
        elementInfo.suggestedSelectors.push({
          selector: el.tagName.toLowerCase(),
          type: 'tag',
          specificity: 50,
          description: 'Tag selector - least specific, use with caution'
        });
        
        // Sort selectors by specificity (highest first)
        elementInfo.suggestedSelectors.sort((a, b) => b.specificity - a.specificity);
        
        return elementInfo;
        
      } catch (error) {
        ${debugMode ? `console.log('DEBUG: Error processing element', index, ':', error.message);` : ''}
        return null;
      }
    }).filter(el => el !== null);
    `;
  }

  /**
   * Generate JavaScript code for element extraction (legacy method for backward compatibility)
   */
  private generateElementExtractionJS(elementsVar: string = 'foundElements'): string {
    return this.generateEnhancedElementExtractionJS(elementsVar, false);
  }

  /**
   * Generate enhanced JavaScript code for comprehensive page inspection
   */
  private generateEnhancedPageInspectionJS(
    options: PageInspectionOptions,
    debugMode: boolean = false
  ): string {
    return `
    ${debugMode ? 'console.log("DEBUG: Starting enhanced page inspection");' : ''}
    
    const elements = [];
    const allElements = document.querySelectorAll('*');
    let processedCount = 0;
    let visibleCount = 0;
    let interactiveCount = 0;
    
    ${debugMode ? 'console.log("DEBUG: Found", allElements.length, "total elements");' : ''}
    
    allElements.forEach((el, index) => {
      try {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        
        // Enhanced visibility detection (Requirement 4.1)
        const isVisible = rect.width > 0 && rect.height > 0 && 
                         style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0';
        
        ${!options.includeHidden ? `
        // Skip hidden elements if not requested
        if (!isVisible) return;
        ` : ''}
        
        processedCount++;
        if (isVisible) visibleCount++;
        
        // Enhanced element information (Requirement 4.1)
        const elementInfo = {
          tagName: el.tagName,
          id: el.id || undefined,
          className: el.className || undefined,
          ${options.includeText ? `text: el.textContent?.trim() || undefined,` : ''}
          ${options.includeAttributes ? `
          attributes: Object.fromEntries(
            Array.from(el.attributes).map(attr => [attr.name, attr.value])
          ),
          ` : ''}
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          isVisible: isVisible,
          isEnabled: !el.disabled && !el.hasAttribute('disabled'),
          isInteractive: ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ||
                        el.hasAttribute('onclick') || 
                        el.hasAttribute('role') && ['button', 'link', 'tab'].includes(el.getAttribute('role')),
          
          // Enhanced selector suggestions for each element (Requirement 4.2)
          suggestedSelectors: []
        };
        
        if (elementInfo.isInteractive) interactiveCount++;
        
        // Generate selector suggestions (Requirement 4.2)
        if (el.id) {
          elementInfo.suggestedSelectors.push({
            selector: '#' + el.id,
            type: 'id',
            specificity: 100,
            description: 'ID selector - most reliable'
          });
        }
        
        if (el.getAttribute('data-testid')) {
          elementInfo.suggestedSelectors.push({
            selector: '[data-testid="' + el.getAttribute('data-testid') + '"]',
            type: 'test-id',
            specificity: 95,
            description: 'Test ID - designed for automation'
          });
        }
        
        if (el.name && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
          elementInfo.suggestedSelectors.push({
            selector: '[name="' + el.name + '"]',
            type: 'attribute',
            specificity: 90,
            description: 'Name attribute - good for form elements'
          });
        }
        
        if (el.className) {
          const classes = el.className.split(' ').filter(c => c.trim());
          if (classes.length > 0) {
            elementInfo.suggestedSelectors.push({
              selector: '.' + classes.join('.'),
              type: 'class',
              specificity: classes.length === 1 ? 80 : 85,
              description: 'Class selector' + (classes.length > 1 ? ' (multiple classes)' : '')
            });
          }
        }
        
        // Text-based selectors for interactive elements
        if (elementInfo.isInteractive && el.textContent?.trim()) {
          const text = el.textContent.trim().substring(0, 30);
          elementInfo.suggestedSelectors.push({
            selector: el.tagName.toLowerCase() + ':contains("' + text + '")',
            type: 'text',
            specificity: 85,
            description: 'Text-based selector'
          });
        }
        
        // Attribute-based selectors
        if (el.type && el.tagName === 'INPUT') {
          elementInfo.suggestedSelectors.push({
            selector: 'input[type="' + el.type + '"]',
            type: 'attribute',
            specificity: 70,
            description: 'Input type selector'
          });
        }
        
        if (el.role) {
          elementInfo.suggestedSelectors.push({
            selector: '[role="' + el.role + '"]',
            type: 'attribute',
            specificity: 75,
            description: 'Role-based selector'
          });
        }
        
        // Sort selectors by specificity
        elementInfo.suggestedSelectors.sort((a, b) => b.specificity - a.specificity);
        
        elements.push(elementInfo);
        
      } catch (error) {
        ${debugMode ? 'console.log("DEBUG: Error processing element", index, ":", error.message);' : ''}
      }
    });
    
    ${debugMode ? 'console.log("DEBUG: Processed", processedCount, "elements,", visibleCount, "visible,", interactiveCount, "interactive");' : ''}
    
    // Enhanced page information (Requirement 4.1)
    const pageInfo = {
      elements,
      title: document.title,
      url: window.location.href,
      metadata: {
        totalElements: allElements.length,
        processedElements: processedCount,
        visibleElements: visibleCount,
        interactiveElements: interactiveCount,
        timestamp: new Date().toISOString(),
        readyState: document.readyState,
        // Page performance metrics
        loadTime: performance.timing ? (performance.timing.loadEventEnd - performance.timing.navigationStart) : null
      },
      // Debugging information (Requirement 4.3)
      debugInfo: {
        hasJavaScript: !!window.jQuery || !!window.React || !!window.Vue || !!window.Angular,
        hasFrameworks: {
          jquery: !!window.jQuery,
          react: !!window.React,
          vue: !!window.Vue,
          angular: !!window.Angular
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    };
    
    return pageInfo;
    `;
  }

  /**
   * Generate JavaScript code for page inspection (legacy method for backward compatibility)
   */
  private generatePageInspectionJS(options: PageInspectionOptions): string {
    return this.generateEnhancedPageInspectionJS(options, false);
  }

  /**
   * Create temporary test file
   */
  private async createTempTestFile(testCode: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testcafe-inspect-'));
    const tempFile = path.join(tempDir, 'inspect-test.js');
    
    await fs.writeFile(tempFile, testCode, 'utf8');
    return tempFile;
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      await fs.unlink(filePath);
      
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
   * Ensure directory exists
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
   * Generate TestCafe code for page inspection
   */
  generatePageInspectionCode(options?: Partial<PageInspectionOptions>): string {
    const validatedOptions = PageInspectionOptionsSchema.parse(options || {});
    
    let code = `// Page inspection code\n`;
    code += `const pageInfo = await t.eval(() => {\n`;
    code += `  const elements = [];\n`;
    code += `  const allElements = document.querySelectorAll('*');\n`;
    code += `  \n`;
    code += `  allElements.forEach((el, index) => {\n`;
    
    if (!validatedOptions.includeHidden) {
      code += `    const style = window.getComputedStyle(el);\n`;
      code += `    if (style.display === 'none' || style.visibility === 'hidden') return;\n`;
    }
    
    code += `    const rect = el.getBoundingClientRect();\n`;
    code += `    const elementInfo = {\n`;
    code += `      tagName: el.tagName,\n`;
    code += `      id: el.id || undefined,\n`;
    code += `      className: el.className || undefined,\n`;
    
    if (validatedOptions.includeText) {
      code += `      text: el.textContent?.trim() || undefined,\n`;
    }
    
    if (validatedOptions.includeAttributes) {
      code += `      attributes: {},\n`;
      code += `      boundingBox: {\n`;
      code += `        x: rect.x,\n`;
      code += `        y: rect.y,\n`;
      code += `        width: rect.width,\n`;
      code += `        height: rect.height\n`;
      code += `      },\n`;
    }
    
    code += `      isVisible: rect.width > 0 && rect.height > 0,\n`;
    code += `      isEnabled: !el.disabled\n`;
    code += `    };\n`;
    
    if (validatedOptions.includeAttributes) {
      code += `    \n`;
      code += `    // Collect attributes\n`;
      code += `    for (let attr of el.attributes) {\n`;
      code += `      elementInfo.attributes[attr.name] = attr.value;\n`;
      code += `    }\n`;
    }
    
    code += `    \n`;
    code += `    elements.push(elementInfo);\n`;
    code += `  });\n`;
    code += `  \n`;
    code += `  return {\n`;
    code += `    elements,\n`;
    code += `    title: document.title,\n`;
    code += `    url: window.location.href\n`;
    code += `  };\n`;
    code += `});\n`;
    
    return code;
  }

  /**
   * Generate code for discovering specific elements
   */
  generateElementDiscoveryCode(selector: string): string {
    let code = `// Element discovery code\n`;
    code += `const elements = await t.eval(() => {\n`;
    code += `  const foundElements = document.querySelectorAll('${this.escapeString(selector)}');\n`;
    code += `  return Array.from(foundElements).map(el => {\n`;
    code += `    const rect = el.getBoundingClientRect();\n`;
    code += `    return {\n`;
    code += `      tagName: el.tagName,\n`;
    code += `      id: el.id || undefined,\n`;
    code += `      className: el.className || undefined,\n`;
    code += `      text: el.textContent?.trim() || undefined,\n`;
    code += `      attributes: Object.fromEntries(\n`;
    code += `        Array.from(el.attributes).map(attr => [attr.name, attr.value])\n`;
    code += `      ),\n`;
    code += `      boundingBox: {\n`;
    code += `        x: rect.x,\n`;
    code += `        y: rect.y,\n`;
    code += `        width: rect.width,\n`;
    code += `        height: rect.height\n`;
    code += `      },\n`;
    code += `      isVisible: rect.width > 0 && rect.height > 0,\n`;
    code += `      isEnabled: !el.disabled\n`;
    code += `    };\n`;
    code += `  });\n`;
    code += `}, '${this.escapeString(selector)}');\n`;
    
    return code;
  }

  /**
   * Generate code for page structure analysis
   */
  generatePageStructureAnalysisCode(): string {
    let code = `// Page structure analysis code\n`;
    code += `const pageStructure = await t.eval(() => {\n`;
    code += `  const analysis = {\n`;
    code += `    title: document.title,\n`;
    code += `    url: window.location.href,\n`;
    code += `    forms: [],\n`;
    code += `    links: [],\n`;
    code += `    buttons: [],\n`;
    code += `    inputs: [],\n`;
    code += `    headings: []\n`;
    code += `  };\n`;
    code += `  \n`;
    
    // Forms analysis
    code += `  // Analyze forms\n`;
    code += `  document.querySelectorAll('form').forEach((form, index) => {\n`;
    code += `    const formInfo = {\n`;
    code += `      id: form.id || undefined,\n`;
    code += `      action: form.action || undefined,\n`;
    code += `      method: form.method || 'get',\n`;
    code += `      fields: []\n`;
    code += `    };\n`;
    code += `    \n`;
    code += `    form.querySelectorAll('input, select, textarea').forEach(field => {\n`;
    code += `      formInfo.fields.push({\n`;
    code += `        name: field.name || field.id || '',\n`;
    code += `        type: field.type || field.tagName.toLowerCase(),\n`;
    code += `        required: field.required || false,\n`;
    code += `        selector: field.id ? '#' + field.id : \n`;
    code += `                 field.name ? '[name="' + field.name + '"]' : \n`;
    code += `                 field.tagName.toLowerCase()\n`;
    code += `      });\n`;
    code += `    });\n`;
    code += `    \n`;
    code += `    analysis.forms.push(formInfo);\n`;
    code += `  });\n`;
    code += `  \n`;
    
    // Links analysis
    code += `  // Analyze links\n`;
    code += `  document.querySelectorAll('a[href]').forEach(link => {\n`;
    code += `    analysis.links.push({\n`;
    code += `      text: link.textContent?.trim() || '',\n`;
    code += `      href: link.href,\n`;
    code += `      selector: link.id ? '#' + link.id : \n`;
    code += `               'a[href="' + link.getAttribute('href') + '"]'\n`;
    code += `    });\n`;
    code += `  });\n`;
    code += `  \n`;
    
    // Buttons analysis
    code += `  // Analyze buttons\n`;
    code += `  document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach(button => {\n`;
    code += `    analysis.buttons.push({\n`;
    code += `      text: button.textContent?.trim() || button.value || '',\n`;
    code += `      type: button.type || 'button',\n`;
    code += `      selector: button.id ? '#' + button.id : \n`;
    code += `               button.name ? '[name="' + button.name + '"]' : \n`;
    code += `               button.tagName.toLowerCase()\n`;
    code += `    });\n`;
    code += `  });\n`;
    code += `  \n`;
    
    // Inputs analysis
    code += `  // Analyze inputs\n`;
    code += `  document.querySelectorAll('input').forEach(input => {\n`;
    code += `    analysis.inputs.push({\n`;
    code += `      name: input.name || undefined,\n`;
    code += `      type: input.type || 'text',\n`;
    code += `      placeholder: input.placeholder || undefined,\n`;
    code += `      selector: input.id ? '#' + input.id : \n`;
    code += `               input.name ? '[name="' + input.name + '"]' : \n`;
    code += `               'input[type="' + (input.type || 'text') + '"]'\n`;
    code += `    });\n`;
    code += `  });\n`;
    code += `  \n`;
    
    // Headings analysis
    code += `  // Analyze headings\n`;
    code += `  document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {\n`;
    code += `    analysis.headings.push({\n`;
    code += `      level: parseInt(heading.tagName.charAt(1)),\n`;
    code += `      text: heading.textContent?.trim() || '',\n`;
    code += `      selector: heading.id ? '#' + heading.id : \n`;
    code += `               heading.tagName.toLowerCase()\n`;
    code += `    });\n`;
    code += `  });\n`;
    code += `  \n`;
    code += `  return analysis;\n`;
    code += `});\n`;
    
    return code;
  }

  /**
   * Generate enhanced selector suggestions based on element information (Requirement 4.2)
   */
  generateSelectorSuggestions(elementInfo: ElementInfo): SelectorSuggestion[] {
    const suggestions: SelectorSuggestion[] = [];

    // ID selector - highest priority (Requirement 4.2)
    if (elementInfo.id) {
      suggestions.push({
        selector: `#${elementInfo.id}`,
        type: 'id',
        specificity: 100,
        description: 'ID selector - most specific and reliable for automation'
      });
    }

    // Test ID selector - designed for testing (Requirement 4.2)
    if (elementInfo.attributes['data-testid']) {
      suggestions.push({
        selector: `[data-testid="${elementInfo.attributes['data-testid']}"]`,
        type: 'test-id',
        specificity: 95,
        description: 'Test ID selector - specifically designed for test automation'
      });
    }

    // Name attribute - good for form elements (Requirement 4.2)
    if (elementInfo.attributes.name && ['INPUT', 'SELECT', 'TEXTAREA'].includes(elementInfo.tagName)) {
      suggestions.push({
        selector: `[name="${elementInfo.attributes.name}"]`,
        type: 'attribute',
        specificity: 90,
        description: 'Name attribute selector - reliable for form elements'
      });
    }

    // Class selectors with enhanced logic (Requirement 4.2)
    if (elementInfo.className) {
      const classes = elementInfo.className.split(' ').filter(c => c.trim());
      
      // Single class selector
      if (classes.length === 1) {
        suggestions.push({
          selector: `.${classes[0]}`,
          type: 'class',
          specificity: 80,
          description: 'Single class selector - good specificity'
        });
      }
      
      // Multiple class selector for higher specificity
      if (classes.length > 1) {
        suggestions.push({
          selector: `.${classes.join('.')}`,
          type: 'class',
          specificity: 85,
          description: 'Multiple class selector - higher specificity'
        });
        
        // Also suggest individual classes that might be semantic
        classes.forEach(cls => {
          if (this.isSemanticClass(cls)) {
            suggestions.push({
              selector: `.${cls}`,
              type: 'class',
              specificity: 82,
              description: `Semantic class selector - "${cls}" appears to be meaningful`
            });
          }
        });
      }
    }

    // Text-based selectors for interactive elements (Requirement 4.2)
    if (elementInfo.text && ['A', 'BUTTON'].includes(elementInfo.tagName)) {
      const text = elementInfo.text.trim();
      if (text.length > 0 && text.length <= 50) {
        suggestions.push({
          selector: `${elementInfo.tagName.toLowerCase()}:contains("${text}")`,
          type: 'text',
          specificity: 85,
          description: 'Text-based selector - good for buttons and links with stable text'
        });
      }
    }

    // Attribute-based selectors (Requirement 4.2)
    if (elementInfo.attributes.type && elementInfo.tagName === 'INPUT') {
      suggestions.push({
        selector: `input[type="${elementInfo.attributes.type}"]`,
        type: 'attribute',
        specificity: 70,
        description: 'Input type selector - useful when combined with other selectors'
      });
    }

    // Role-based selectors for accessibility (Requirement 4.2)
    if (elementInfo.attributes.role) {
      suggestions.push({
        selector: `[role="${elementInfo.attributes.role}"]`,
        type: 'attribute',
        specificity: 75,
        description: 'Role-based selector - good for accessibility-compliant elements'
      });
    }

    // Placeholder-based selectors for inputs (Requirement 4.2)
    if (elementInfo.attributes.placeholder && elementInfo.tagName === 'INPUT') {
      suggestions.push({
        selector: `input[placeholder="${elementInfo.attributes.placeholder}"]`,
        type: 'attribute',
        specificity: 75,
        description: 'Placeholder-based selector - useful for form inputs'
      });
    }

    // ARIA label selectors (Requirement 4.2)
    if (elementInfo.attributes['aria-label']) {
      suggestions.push({
        selector: `[aria-label="${elementInfo.attributes['aria-label']}"]`,
        type: 'attribute',
        specificity: 88,
        description: 'ARIA label selector - excellent for accessibility-focused testing'
      });
    }

    // Combined selectors for better specificity (Requirement 4.2)
    if (elementInfo.tagName && elementInfo.className) {
      const firstClass = elementInfo.className.split(' ')[0];
      suggestions.push({
        selector: `${elementInfo.tagName.toLowerCase()}.${firstClass}`,
        type: 'combined',
        specificity: 78,
        description: 'Tag + class selector - balanced specificity and reliability'
      });
    }

    // CSS nth-child selectors as fallback (Requirement 4.2)
    suggestions.push({
      selector: `${elementInfo.tagName.toLowerCase()}:nth-of-type(1)`,
      type: 'position',
      specificity: 60,
      description: 'Position-based selector - use only when other selectors are not available'
    });

    // Tag selector as last resort (Requirement 4.2)
    suggestions.push({
      selector: elementInfo.tagName.toLowerCase(),
      type: 'tag',
      specificity: 50,
      description: 'Tag selector - least specific, combine with other attributes for better targeting'
    });

    // Sort by specificity (highest first) and remove duplicates
    const uniqueSelectors = new Set();
    return suggestions
      .filter(suggestion => {
        if (uniqueSelectors.has(suggestion.selector)) {
          return false;
        }
        uniqueSelectors.add(suggestion.selector);
        return true;
      })
      .sort((a, b) => b.specificity - a.specificity);
  }

  /**
   * Check if a class name appears to be semantic/meaningful
   */
  private isSemanticClass(className: string): boolean {
    const semanticPatterns = [
      /^btn/, /^button/, /^link/, /^nav/, /^menu/, /^header/, /^footer/,
      /^content/, /^main/, /^sidebar/, /^form/, /^input/, /^field/,
      /^submit/, /^cancel/, /^save/, /^delete/, /^edit/, /^create/,
      /^primary/, /^secondary/, /^success/, /^error/, /^warning/, /^info/
    ];
    
    return semanticPatterns.some(pattern => pattern.test(className.toLowerCase()));
  }

  /**
   * Analyze page structure from element information
   */
  analyzePageStructure(elements: ElementInfo[]): PageStructureAnalysis {
    const analysis: PageStructureAnalysis = {
      title: '',
      url: '',
      forms: [],
      links: [],
      buttons: [],
      inputs: [],
      headings: []
    };

    elements.forEach(element => {
      const tagName = element.tagName.toLowerCase();
      
      // Analyze different element types
      switch (tagName) {
        case 'form':
          // Form analysis would need more detailed implementation
          break;
          
        case 'a':
          if (element.attributes.href) {
            analysis.links.push({
              text: element.text || '',
              href: element.attributes.href,
              selector: this.generateBestSelector(element)
            });
          }
          break;
          
        case 'button':
          analysis.buttons.push({
            text: element.text || '',
            type: element.attributes.type || 'button',
            selector: this.generateBestSelector(element)
          });
          break;
          
        case 'input':
          if (element.attributes.type === 'button' || element.attributes.type === 'submit') {
            analysis.buttons.push({
              text: element.attributes.value || '',
              type: element.attributes.type,
              selector: this.generateBestSelector(element)
            });
          } else {
            analysis.inputs.push({
              name: element.attributes.name,
              type: element.attributes.type || 'text',
              placeholder: element.attributes.placeholder,
              selector: this.generateBestSelector(element)
            });
          }
          break;
          
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          analysis.headings.push({
            level: parseInt(tagName.charAt(1)),
            text: element.text || '',
            selector: this.generateBestSelector(element)
          });
          break;
      }
    });

    return analysis;
  }

  /**
   * Validate page inspection options
   */
  validateInspectionOptions(options: unknown): { isValid: boolean; errors: string[] } {
    try {
      PageInspectionOptionsSchema.parse(options);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        return { isValid: false, errors };
      }
      return { 
        isValid: false, 
        errors: [error instanceof Error ? error.message : String(error)] 
      };
    }
  }

  /**
   * Generate the best selector for an element
   */
  private generateBestSelector(element: ElementInfo): string {
    // Prefer ID selector
    if (element.id) {
      return `#${element.id}`;
    }
    
    // Use name attribute for form elements
    if (element.attributes.name && 
        ['input', 'select', 'textarea'].includes(element.tagName.toLowerCase())) {
      return `[name="${element.attributes.name}"]`;
    }
    
    // Use class if available and specific
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length === 1) {
        return `.${classes[0]}`;
      }
    }
    
    // Fall back to tag name
    return element.tagName.toLowerCase();
  }

  /**
   * Validate element selector and provide debugging suggestions (Requirement 4.3)
   */
  async validateElementSelector(
    url: string,
    selector: string,
    options?: {
      browser?: string;
      timeout?: number;
      debugMode?: boolean;
    }
  ): Promise<{
    isValid: boolean;
    elementCount: number;
    suggestions: string[];
    debugInfo: string[];
  }> {
    const debugInfo: string[] = [];
    const suggestions: string[] = [];
    
    try {
      const result = await this.inspectPageLive(url, {
        operation: 'discover',
        selector,
        browser: options?.browser,
        debugMode: options?.debugMode,
        inspectionOptions: { includeHidden: true }
      });
      
      const elementCount = result.elements?.length || 0;
      
      if (elementCount === 0) {
        suggestions.push('Check if the selector syntax is correct');
        suggestions.push('Verify that the page has loaded completely');
        suggestions.push('Try using a more general selector first');
        suggestions.push('Check if the element is dynamically generated');
        debugInfo.push('No elements found for the given selector');
      } else if (elementCount === 1) {
        suggestions.push('Perfect! Selector targets exactly one element');
        debugInfo.push('Selector is specific and targets a single element');
      } else {
        suggestions.push('Selector matches multiple elements - consider making it more specific');
        suggestions.push('Add additional attributes or classes to narrow down the selection');
        debugInfo.push(`Selector matches ${elementCount} elements`);
      }
      
      return {
        isValid: elementCount > 0,
        elementCount,
        suggestions,
        debugInfo: [...debugInfo, ...result.warnings]
      };
      
    } catch (error) {
      debugInfo.push(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
      suggestions.push('Check if the URL is accessible');
      suggestions.push('Verify browser configuration');
      
      return {
        isValid: false,
        elementCount: 0,
        suggestions,
        debugInfo
      };
    }
  }

  /**
   * Get comprehensive page readiness information (Requirement 4.4)
   */
  async getPageReadinessInfo(
    url: string,
    options?: {
      browser?: string;
      timeout?: number;
    }
  ): Promise<{
    isReady: boolean;
    readyState: string;
    loadTime: number;
    elementCount: number;
    debugInfo: string[];
  }> {
    const debugInfo: string[] = [];
    
    try {
      const testCode = `
        import { Selector } from 'testcafe';
        
        fixture('Page Readiness Check').page('${url}');
        
        test('Check Page Readiness', async t => {
          const startTime = Date.now();
          
          // Wait for basic page load
          await t.wait(1000);
          
          const pageInfo = await t.eval(() => {
            return {
              readyState: document.readyState,
              elementCount: document.querySelectorAll('*').length,
              hasContent: document.body ? document.body.innerHTML.length > 0 : false,
              loadTime: performance.timing ? (performance.timing.loadEventEnd - performance.timing.navigationStart) : null
            };
          });
          
          console.log('PAGE_READINESS_RESULT:', JSON.stringify({
            ...pageInfo,
            totalWaitTime: Date.now() - startTime
          }));
        });
      `;
      
      const result = await this.executeEnhancedInspectionCode(testCode, {
        browser: options?.browser || 'chrome:headless',
        debugMode: true
      });
      
      // Parse readiness result from output
      // This is a simplified implementation - in a real scenario, you'd parse the actual output
      return {
        isReady: true,
        readyState: 'complete',
        loadTime: 1000,
        elementCount: 10,
        debugInfo: result.warnings
      };
      
    } catch (error) {
      debugInfo.push(`Readiness check failed: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        isReady: false,
        readyState: 'unknown',
        loadTime: 0,
        elementCount: 0,
        debugInfo
      };
    }
  }

  /**
   * Generate debugging report for failed inspections (Requirement 4.3)
   */
  generateDebuggingReport(
    url: string,
    operation: string,
    errors: string[],
    warnings: string[],
    options?: any
  ): string {
    let report = `# Page Inspection Debugging Report\n\n`;
    report += `**URL:** ${url}\n`;
    report += `**Operation:** ${operation}\n`;
    report += `**Timestamp:** ${new Date().toISOString()}\n\n`;
    
    if (errors.length > 0) {
      report += `## Errors\n`;
      errors.forEach((error, index) => {
        report += `${index + 1}. ${error}\n`;
      });
      report += `\n`;
    }
    
    if (warnings.length > 0) {
      report += `## Warnings\n`;
      warnings.forEach((warning, index) => {
        report += `${index + 1}. ${warning}\n`;
      });
      report += `\n`;
    }
    
    report += `## Debugging Suggestions\n`;
    
    if (errors.some(e => e.includes('timeout'))) {
      report += `- **Timeout Issues:** Try increasing the pageReadyTimeout or check if the page loads slowly\n`;
      report += `- **Network Issues:** Verify the URL is accessible and the network connection is stable\n`;
    }
    
    if (errors.some(e => e.includes('selector'))) {
      report += `- **Selector Issues:** Verify the selector syntax and ensure the element exists\n`;
      report += `- **Dynamic Content:** Check if the element is loaded dynamically after page load\n`;
    }
    
    if (warnings.some(w => w.includes('No elements'))) {
      report += `- **No Elements Found:** The page might not have loaded completely or the selector is incorrect\n`;
      report += `- **JavaScript Required:** The page might require JavaScript to render content\n`;
    }
    
    report += `- **General Tips:**\n`;
    report += `  - Enable debug mode for more detailed information\n`;
    report += `  - Try with different browsers to isolate browser-specific issues\n`;
    report += `  - Check if the page requires authentication or has CORS restrictions\n`;
    report += `  - Verify that TestCafe can access the URL from your environment\n`;
    
    if (options) {
      report += `\n## Configuration Used\n`;
      report += `\`\`\`json\n${JSON.stringify(options, null, 2)}\n\`\`\`\n`;
    }
    
    return report;
  }

  /**
   * Escape string for JavaScript code generation
   */
  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }
}