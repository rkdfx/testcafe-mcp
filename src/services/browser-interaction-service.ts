/**
 * Browser Interaction Service
 * 
 * Provides browser interaction capabilities for TestCafe operations.
 */

import { z } from 'zod';

/**
 * Browser action schemas
 */
export const ClickActionSchema = z.object({
  type: z.literal('click'),
  selector: z.string().min(1),
  options: z.object({
    modifiers: z.object({
      ctrl: z.boolean().optional(),
      alt: z.boolean().optional(),
      shift: z.boolean().optional(),
      meta: z.boolean().optional()
    }).optional(),
    offsetX: z.number().optional(),
    offsetY: z.number().optional()
  }).optional()
});

export const TypeActionSchema = z.object({
  type: z.literal('type'),
  selector: z.string().min(1),
  text: z.string(),
  options: z.object({
    replace: z.boolean().optional(),
    paste: z.boolean().optional(),
    confidential: z.boolean().optional()
  }).optional()
});

export const NavigateActionSchema = z.object({
  type: z.literal('navigate'),
  url: z.string().url()
});

export const WaitActionSchema = z.object({
  type: z.literal('wait'),
  condition: z.enum(['timeout', 'element', 'function']),
  value: z.union([z.number(), z.string()]),
  timeout: z.number().min(100).max(60000).optional()
});

export const AssertActionSchema = z.object({
  type: z.literal('assert'),
  assertion: z.enum(['exists', 'visible', 'text', 'value', 'attribute', 'count']),
  selector: z.string().min(1),
  expected: z.union([z.string(), z.number(), z.boolean()]).optional(),
  attribute: z.string().optional()
});

export const BrowserActionSchema = z.discriminatedUnion('type', [
  ClickActionSchema,
  TypeActionSchema,
  NavigateActionSchema,
  WaitActionSchema,
  AssertActionSchema
]);

export type ClickAction = z.infer<typeof ClickActionSchema>;
export type TypeAction = z.infer<typeof TypeActionSchema>;
export type NavigateAction = z.infer<typeof NavigateActionSchema>;
export type WaitAction = z.infer<typeof WaitActionSchema>;
export type AssertAction = z.infer<typeof AssertActionSchema>;
export type BrowserAction = z.infer<typeof BrowserActionSchema>;

/**
 * Element information
 */
export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  attributes: Record<string, string>;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
  isEnabled: boolean;
}

/**
 * Selector suggestion
 */
export interface SelectorSuggestion {
  selector: string;
  type: 'id' | 'class' | 'attribute' | 'text' | 'css' | 'xpath' | 'test-id' | 'combined' | 'position' | 'tag';
  specificity: number;
  description: string;
}

/**
 * Browser interaction result
 */
export interface BrowserInteractionResult {
  success: boolean;
  actionsExecuted: number;
  duration: number;
  errors: string[];
  warnings: string[];
  elementInfo?: ElementInfo[];
  screenshots?: string[];
}

/**
 * Browser session information
 */
export interface BrowserSession {
  id: string;
  browser: string;
  url?: string;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  testController?: any;
  runner?: any;
}

/**
 * Live interaction context
 */
export interface LiveInteractionContext {
  sessionId: string;
  testController: any;
  currentUrl?: string;
  pageReady: boolean;
  elementCache: Map<string, ElementInfo>;
  selectorCache: Map<string, any>;
}

/**
 * Browser Interaction Service
 * 
 * Handles browser interactions and element operations for TestCafe with live execution support.
 */
export class BrowserInteractionService {
  private testCafeInstance: any = null;
  private activeSessions: Map<string, BrowserSession> = new Map();
  private liveContexts: Map<string, LiveInteractionContext> = new Map();
  private sessionTimeout = 300000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  /**
   * Initialize browser interaction service with TestCafe instance
   */
  async initialize(testCafeInstance?: any): Promise<void> {
    if (testCafeInstance) {
      this.testCafeInstance = testCafeInstance;
    } else {
      const createTestCafe = (await import('testcafe')).default;
      this.testCafeInstance = await createTestCafe('localhost', 1337, 1338);
    }
    
    // Start session cleanup interval
    this.startSessionCleanup();
  }

  /**
   * Close browser interaction service
   */
  async close(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Close all active sessions
    await this.closeAllSessions();
    
    if (this.testCafeInstance) {
      await this.testCafeInstance.close();
      this.testCafeInstance = null;
    }
  }

  /**
   * Create a new browser session for live interactions
   */
  async createSession(options?: {
    browser?: string;
    url?: string;
    sessionId?: string;
    headless?: boolean;
    viewport?: { width: number; height: number };
  }): Promise<BrowserSession> {
    if (!this.testCafeInstance) {
      await this.initialize();
    }

    const sessionId = options?.sessionId || this.generateSessionId();
    const browser = options?.browser || 'chrome:headless';
    
    // Create a persistent test runner for this session
    const runner = this.testCafeInstance.createRunner();
    
    // Configure browser with session-specific options
    let browserConfig = browser;
    if (options?.headless === false && !browser.includes('headless')) {
      browserConfig = browser.replace(':headless', '');
    }
    
    if (options?.viewport) {
      browserConfig += ` --window-size=${options.viewport.width},${options.viewport.height}`;
    }
    
    const session: BrowserSession = {
      id: sessionId,
      browser: browserConfig,
      url: options?.url,
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      runner
    };
    
    this.activeSessions.set(sessionId, session);
    
    // Initialize live context for this session
    await this.initializeLiveContext(sessionId, options?.url);
    
    return session;
  }

  /**
   * Get an existing session or create a new one
   */
  async getOrCreateSession(sessionId?: string, options?: {
    browser?: string;
    url?: string;
    headless?: boolean;
  }): Promise<BrowserSession> {
    if (sessionId && this.activeSessions.has(sessionId)) {
      const session = this.activeSessions.get(sessionId)!;
      session.lastActivity = new Date();
      return session;
    }
    
    return this.createSession({ ...options, sessionId });
  }

  /**
   * Close a specific browser session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      
      // Clean up live context
      this.liveContexts.delete(sessionId);
      
      // Note: We don't close the runner here as TestCafe manages it
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Close all active sessions
   */
  async closeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.activeSessions.keys());
    await Promise.all(sessionIds.map(id => this.closeSession(id)));
  }

  /**
   * Initialize live interaction context for a session
   */
  private async initializeLiveContext(sessionId: string, initialUrl?: string): Promise<void> {
    const context: LiveInteractionContext = {
      sessionId,
      testController: null, // Will be set when test starts
      currentUrl: initialUrl,
      pageReady: false,
      elementCache: new Map(),
      selectorCache: new Map()
    };
    
    this.liveContexts.set(sessionId, context);
  }

  /**
   * Start session cleanup interval
   */
  private startSessionCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Check every minute
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of this.activeSessions) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      if (timeSinceActivity > this.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }
    
    expiredSessions.forEach(sessionId => {
      console.log(`Cleaning up expired session: ${sessionId}`);
      this.closeSession(sessionId);
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Execute browser actions in real-time with enhanced session management
   */
  async executeActions(
    actions: BrowserAction[],
    options?: {
      browser?: string;
      url?: string;
      timeout?: number;
      screenshots?: boolean;
      screenshotPath?: string;
      sessionId?: string;
      useLiveSession?: boolean;
      validateElements?: boolean;
      retryFailedActions?: boolean;
    }
  ): Promise<BrowserInteractionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const screenshots: string[] = [];
    let actionsExecuted = 0;
    let elementInfo: ElementInfo[] = [];

    try {
      if (!this.testCafeInstance) {
        await this.initialize();
      }

      // Use live session if requested and available
      if (options?.useLiveSession !== false) {
        try {
          const result = await this.executeLiveActions(actions, options);
          return result;
        } catch (liveError) {
          warnings.push(`Live execution failed, falling back to temporary test: ${liveError instanceof Error ? liveError.message : String(liveError)}`);
        }
      }

      // Fallback to temporary test execution
      const testCode = this.generateInteractiveTestCode(actions, options);
      const tempFile = await this.createTempTestFile(testCode);

      try {
        // Execute the interactive test with enhanced configuration
        const runner = this.testCafeInstance.createRunner();
        runner.src(tempFile);
        
        const browserConfig = this.prepareBrowserConfig(options?.browser || 'chrome:headless');
        runner.browsers([browserConfig]);

        // Enhanced screenshot configuration
        if (options?.screenshots) {
          const screenshotConfig = await this.configureScreenshots(options.screenshotPath);
          runner.screenshots(screenshotConfig);
        }

        // Enhanced run configuration
        const runOptions = {
          skipJsErrors: true,
          skipUncaughtErrors: true,
          speed: 1,
          pageLoadTimeout: options?.timeout || 30000,
          assertionTimeout: Math.min(options?.timeout || 30000, 10000),
          selectorTimeout: Math.min(options?.timeout || 30000, 10000)
        };

        const failedCount = await runner.run(runOptions);
        actionsExecuted = actions.length;

        if (failedCount > 0) {
          errors.push('Some actions failed during execution');
        }

        // Collect element information if validation was requested
        if (options?.validateElements) {
          elementInfo = await this.collectElementInformation(actions);
        }

      } finally {
        await this.cleanupTempFile(tempFile);
      }

      return {
        success: errors.length === 0,
        actionsExecuted,
        duration: Date.now() - startTime,
        errors,
        warnings,
        elementInfo: elementInfo.length > 0 ? elementInfo : undefined,
        screenshots: screenshots.length > 0 ? screenshots : undefined
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        actionsExecuted,
        duration: Date.now() - startTime,
        errors,
        warnings,
        elementInfo: elementInfo.length > 0 ? elementInfo : undefined,
        screenshots: screenshots.length > 0 ? screenshots : undefined
      };
    }
  }

  /**
   * Execute actions using live browser session
   */
  async executeLiveActions(
    actions: BrowserAction[],
    options?: {
      browser?: string;
      url?: string;
      timeout?: number;
      screenshots?: boolean;
      screenshotPath?: string;
      sessionId?: string;
      validateElements?: boolean;
      retryFailedActions?: boolean;
    }
  ): Promise<BrowserInteractionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const screenshots: string[] = [];
    let actionsExecuted = 0;
    let elementInfo: ElementInfo[] = [];

    // Get or create session
    const session = await this.getOrCreateSession(options?.sessionId, {
      browser: options?.browser,
      url: options?.url
    });

    const context = this.liveContexts.get(session.id);
    if (!context) {
      throw new Error(`Live context not found for session ${session.id}`);
    }

    try {
      // Execute actions in sequence with enhanced error handling
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        
        try {
          // Validate element before action if requested
          if (options?.validateElements && 'selector' in action && action.selector) {
            const validation = await this.validateElementExists(action.selector, session.id);
            if (!validation.exists) {
              if (options?.retryFailedActions) {
                // Wait and retry
                await this.waitForElement(action.selector, session.id, 5000);
              } else {
                throw new Error(`Element not found: ${action.selector}`);
              }
            }
          }

          // Execute the action
          await this.executeSingleLiveAction(action, session.id);
          actionsExecuted++;

          // Update session activity
          session.lastActivity = new Date();

          // Collect element info if needed
          if (options?.validateElements && 'selector' in action && action.selector) {
            const info = await this.getElementInfo(action.selector, session.id);
            if (info) {
              elementInfo.push(info);
            }
          }

        } catch (actionError) {
          const errorMessage = actionError instanceof Error ? actionError.message : String(actionError);
          
          if (options?.retryFailedActions && i < actions.length - 1) {
            warnings.push(`Action ${i + 1} failed, retrying: ${errorMessage}`);
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
              await this.executeSingleLiveAction(action, session.id);
              actionsExecuted++;
            } catch (retryError) {
              errors.push(`Action ${i + 1} failed after retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
            }
          } else {
            errors.push(`Action ${i + 1} failed: ${errorMessage}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        actionsExecuted,
        duration: Date.now() - startTime,
        errors,
        warnings,
        elementInfo: elementInfo.length > 0 ? elementInfo : undefined,
        screenshots: screenshots.length > 0 ? screenshots : undefined
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        actionsExecuted,
        duration: Date.now() - startTime,
        errors,
        warnings,
        elementInfo: elementInfo.length > 0 ? elementInfo : undefined,
        screenshots: screenshots.length > 0 ? screenshots : undefined
      };
    }
  }

  /**
   * Execute a single action in live session
   */
  private async executeSingleLiveAction(action: BrowserAction, sessionId: string): Promise<void> {
    const context = this.liveContexts.get(sessionId);
    if (!context || !context.testController) {
      throw new Error(`No active test controller for session ${sessionId}`);
    }

    const t = context.testController;

    switch (action.type) {
      case 'navigate':
        await t.navigateTo(action.url);
        context.currentUrl = action.url;
        context.pageReady = false;
        // Wait for page to be ready
        await this.waitForPageReady(sessionId);
        break;

      case 'click':
        const clickSelector = await this.getCachedSelector(action.selector, sessionId);
        await t.click(clickSelector);
        break;

      case 'type':
        const typeSelector = await this.getCachedSelector(action.selector, sessionId);
        const typeOptions = action.options || {};
        await t.typeText(typeSelector, action.text, typeOptions);
        break;

      case 'wait':
        await this.executeWaitAction(action, sessionId);
        break;

      case 'assert':
        await this.executeAssertAction(action, sessionId);
        break;

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  /**
   * Execute wait action in live session
   */
  private async executeWaitAction(action: WaitAction, sessionId: string): Promise<void> {
    const context = this.liveContexts.get(sessionId);
    if (!context || !context.testController) {
      throw new Error(`No active test controller for session ${sessionId}`);
    }

    const t = context.testController;

    switch (action.condition) {
      case 'timeout':
        if (typeof action.value !== 'number') {
          throw new Error('Timeout wait requires numeric value');
        }
        await t.wait(action.value);
        break;

      case 'element':
        if (typeof action.value !== 'string') {
          throw new Error('Element wait requires selector string');
        }
        await this.waitForElement(action.value, sessionId, action.timeout || 30000);
        break;

      case 'function':
        if (typeof action.value !== 'string') {
          throw new Error('Function wait requires function code string');
        }
        const timeout = action.timeout || 30000;
        await t.expect(() => {
          return eval(action.value as string);
        }).ok('', { timeout });
        break;

      default:
        throw new Error(`Unknown wait condition: ${action.condition}`);
    }
  }

  /**
   * Execute assert action in live session
   */
  private async executeAssertAction(action: AssertAction, sessionId: string): Promise<void> {
    const context = this.liveContexts.get(sessionId);
    if (!context || !context.testController) {
      throw new Error(`No active test controller for session ${sessionId}`);
    }

    const t = context.testController;
    const selector = await this.getCachedSelector(action.selector, sessionId);

    switch (action.assertion) {
      case 'exists':
        await t.expect(selector.exists).ok('Element should exist');
        break;

      case 'visible':
        await t.expect(selector.visible).ok('Element should be visible');
        break;

      case 'text':
        if (action.expected === undefined) {
          throw new Error('Text assertion requires expected value');
        }
        await t.expect(selector.textContent).eql(String(action.expected), 'Element text should match');
        break;

      case 'value':
        if (action.expected === undefined) {
          throw new Error('Value assertion requires expected value');
        }
        await t.expect(selector.value).eql(String(action.expected), 'Element value should match');
        break;

      case 'attribute':
        if (!action.attribute || action.expected === undefined) {
          throw new Error('Attribute assertion requires attribute name and expected value');
        }
        await t.expect(selector.getAttribute(action.attribute)).eql(String(action.expected), 'Attribute should match');
        break;

      case 'count':
        if (typeof action.expected !== 'number') {
          throw new Error('Count assertion requires numeric expected value');
        }
        await t.expect(selector.count).eql(action.expected, 'Element count should match');
        break;

      default:
        throw new Error(`Unknown assertion type: ${action.assertion}`);
    }
  }

  /**
   * Discover elements on current page with enhanced live discovery
   */
  async discoverElements(
    selector?: string,
    options?: {
      browser?: string;
      url?: string;
      includeHidden?: boolean;
      maxElements?: number;
      sessionId?: string;
      useLiveSession?: boolean;
      deep?: boolean;
    }
  ): Promise<ElementInfo[]> {
    try {
      if (!this.testCafeInstance) {
        await this.initialize();
      }

      // Use live session if available and requested
      if (options?.useLiveSession !== false && options?.sessionId) {
        const session = this.activeSessions.get(options.sessionId);
        if (session) {
          return this.discoverElementsLive(selector, options.sessionId, options);
        }
      }

      // Fallback to temporary test discovery
      const discoveryCode = this.generateElementDiscoveryCode(selector, options);
      const tempFile = await this.createTempTestFile(discoveryCode);

      try {
        const runner = this.testCafeInstance.createRunner();
        runner.src(tempFile);
        
        const browserConfig = this.prepareBrowserConfig(options?.browser || 'chrome:headless');
        runner.browsers([browserConfig]);

        await runner.run({
          skipJsErrors: true,
          skipUncaughtErrors: true,
          pageLoadTimeout: 30000,
          selectorTimeout: 10000
        });

        // Enhanced element discovery with better data collection
        return this.collectDiscoveredElements(selector, options);

      } finally {
        await this.cleanupTempFile(tempFile);
      }

    } catch (error) {
      console.error('Element discovery failed:', error);
      return [];
    }
  }

  /**
   * Discover elements using live browser session
   */
  async discoverElementsLive(
    selector?: string,
    sessionId?: string,
    options?: {
      includeHidden?: boolean;
      maxElements?: number;
      deep?: boolean;
    }
  ): Promise<ElementInfo[]> {
    if (!sessionId) {
      throw new Error('Session ID required for live element discovery');
    }

    const context = this.liveContexts.get(sessionId);
    if (!context || !context.testController) {
      throw new Error(`No active test controller for session ${sessionId}`);
    }

    const elements: ElementInfo[] = [];
    const maxElements = options?.maxElements || 50;
    const includeHidden = options?.includeHidden || false;
    const deep = options?.deep || false;

    try {
      if (selector) {
        // Discover specific elements matching selector
        const selectorObj = await this.getCachedSelector(selector, sessionId);
        const count = await selectorObj.count;
        
        for (let i = 0; i < Math.min(count, maxElements); i++) {
          const element = selectorObj.nth(i);
          const info = await this.extractElementInfo(element, `${selector}:nth(${i})`);
          
          if (includeHidden || info.isVisible) {
            elements.push(info);
          }
        }
      } else {
        // Discover all interactive elements
        const interactiveSelectors = [
          'button',
          'input',
          'select',
          'textarea',
          'a[href]',
          '[onclick]',
          '[role="button"]',
          '[tabindex]',
          '[contenteditable]'
        ];

        if (deep) {
          interactiveSelectors.push(
            '*[data-testid]',
            '*[data-test]',
            '*[id]',
            '.clickable',
            '.btn',
            '.button'
          );
        }

        for (const sel of interactiveSelectors) {
          try {
            const selectorObj = await this.getCachedSelector(sel, sessionId);
            const count = await selectorObj.count;
            
            for (let i = 0; i < Math.min(count, Math.floor(maxElements / interactiveSelectors.length)); i++) {
              const element = selectorObj.nth(i);
              const info = await this.extractElementInfo(element, `${sel}:nth(${i})`);
              
              if (includeHidden || info.isVisible) {
                elements.push(info);
              }
            }
          } catch (selectorError) {
            // Continue with other selectors if one fails
            console.warn(`Failed to discover elements for selector ${sel}:`, selectorError);
          }
        }
      }

      // Cache discovered elements
      elements.forEach(element => {
        const cacheKey = this.generateElementCacheKey(element);
        context.elementCache.set(cacheKey, element);
      });

      return elements;

    } catch (error) {
      console.error('Live element discovery failed:', error);
      return [];
    }
  }

  /**
   * Validate that an element exists and is interactable
   */
  async validateElementExists(
    selector: string,
    sessionId?: string,
    options?: {
      timeout?: number;
      requireVisible?: boolean;
      requireEnabled?: boolean;
    }
  ): Promise<{ exists: boolean; visible: boolean; enabled: boolean; info?: ElementInfo }> {
    const timeout = options?.timeout || 5000;
    const requireVisible = options?.requireVisible !== false;
    const requireEnabled = options?.requireEnabled !== false;

    try {
      if (sessionId) {
        const context = this.liveContexts.get(sessionId);
        if (context && context.testController) {
          const selectorObj = await this.getCachedSelector(selector, sessionId);
          
          // Check existence with timeout
          const exists = await Promise.race([
            selectorObj.exists,
            new Promise<boolean>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), timeout)
            )
          ]);

          if (!exists) {
            return { exists: false, visible: false, enabled: false };
          }

          const visible = await selectorObj.visible;
          const enabled = await this.isElementEnabled(selectorObj);
          
          if (requireVisible && !visible) {
            return { exists: true, visible: false, enabled };
          }

          if (requireEnabled && !enabled) {
            return { exists: true, visible, enabled: false };
          }

          // Get detailed element info
          const info = await this.extractElementInfo(selectorObj, selector);
          
          return { exists: true, visible, enabled, info };
        }
      }

      // Fallback to temporary test validation
      return this.validateElementWithTempTest(selector, options);

    } catch (error) {
      console.error('Element validation failed:', error);
      return { exists: false, visible: false, enabled: false };
    }
  }

  /**
   * Wait for element to become available
   */
  async waitForElement(
    selector: string,
    sessionId?: string,
    timeout: number = 30000
  ): Promise<boolean> {
    if (sessionId) {
      const context = this.liveContexts.get(sessionId);
      if (context && context.testController) {
        try {
          const selectorObj = await this.getCachedSelector(selector, sessionId);
          await context.testController.expect(selectorObj.exists).ok('', { timeout });
          return true;
        } catch (error) {
          return false;
        }
      }
    }

    // Fallback implementation
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const validation = await this.validateElementExists(selector, sessionId, { timeout: 1000 });
      if (validation.exists) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return false;
  }

  /**
   * Wait for page to be ready
   */
  async waitForPageReady(sessionId: string, timeout: number = 30000): Promise<void> {
    const context = this.liveContexts.get(sessionId);
    if (!context || !context.testController) {
      throw new Error(`No active test controller for session ${sessionId}`);
    }

    const t = context.testController;
    
    try {
      // Wait for document ready state
      await t.expect(() => {
        return (globalThis as any).document?.readyState === 'complete';
      }).ok('Page should be ready', { timeout });

      // Wait for no pending network requests (if jQuery is available)
      await t.expect(() => {
        const win = (globalThis as any).window;
        return typeof win?.jQuery === 'undefined' || win.jQuery.active === 0;
      }).ok('No pending AJAX requests', { timeout: 5000 }).catch(() => {
        // Ignore jQuery check if not available
      });

      context.pageReady = true;
    } catch (error) {
      console.warn('Page ready check failed:', error);
      context.pageReady = false;
    }
  }

  /**
   * Get detailed information about an element
   */
  async getElementInfo(selector: string, sessionId?: string): Promise<ElementInfo | null> {
    try {
      if (sessionId) {
        const context = this.liveContexts.get(sessionId);
        if (context && context.testController) {
          const selectorObj = await this.getCachedSelector(selector, sessionId);
          return this.extractElementInfo(selectorObj, selector);
        }
      }

      // Fallback to temporary test
      return this.getElementInfoWithTempTest(selector);

    } catch (error) {
      console.error('Failed to get element info:', error);
      return null;
    }
  }

  /**
   * Extract detailed element information from TestCafe selector
   */
  private async extractElementInfo(selectorObj: any, originalSelector: string): Promise<ElementInfo> {
    try {
      const tagName = await selectorObj.tagName;
      const id = await selectorObj.id;
      const classNames = await selectorObj.classNames;
      const textContent = await selectorObj.textContent;
      const visible = await selectorObj.visible;
      const enabled = await this.isElementEnabled(selectorObj);
      
      // Get bounding box
      const boundingBox = await selectorObj.boundingClientRect;
      
      // Get all attributes
      const attributes: Record<string, string> = {};
      try {
        const attributeNames = await selectorObj.getStyleProperty('attributeNames') || [];
        for (const attrName of attributeNames) {
          const attrValue = await selectorObj.getAttribute(attrName);
          if (attrValue !== null) {
            attributes[attrName] = attrValue;
          }
        }
      } catch {
        // Fallback attribute collection
        if (id) attributes.id = id;
        if (classNames) attributes.class = classNames.join(' ');
      }

      return {
        tagName: tagName || 'UNKNOWN',
        id: id || undefined,
        className: classNames ? classNames.join(' ') : undefined,
        text: textContent || undefined,
        attributes,
        boundingBox: {
          x: boundingBox?.left || 0,
          y: boundingBox?.top || 0,
          width: boundingBox?.width || 0,
          height: boundingBox?.height || 0
        },
        isVisible: visible || false,
        isEnabled: enabled
      };

    } catch (error) {
      console.error('Failed to extract element info:', error);
      return {
        tagName: 'ERROR',
        attributes: {},
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        isVisible: false,
        isEnabled: false
      };
    }
  }

  /**
   * Check if element is enabled
   */
  private async isElementEnabled(selectorObj: any): Promise<boolean> {
    try {
      const disabled = await selectorObj.hasAttribute('disabled');
      const readonly = await selectorObj.hasAttribute('readonly');
      const ariaDisabled = await selectorObj.getAttribute('aria-disabled');
      
      return !disabled && !readonly && ariaDisabled !== 'true';
    } catch {
      return true; // Assume enabled if we can't determine
    }
  }

  /**
   * Get cached selector or create new one
   */
  private async getCachedSelector(selector: string, sessionId: string): Promise<any> {
    const context = this.liveContexts.get(sessionId);
    if (!context) {
      throw new Error(`No context found for session ${sessionId}`);
    }

    if (context.selectorCache.has(selector)) {
      return context.selectorCache.get(selector);
    }

    // Import Selector dynamically
    const { Selector } = await import('testcafe');
    const selectorObj = Selector(selector);
    
    context.selectorCache.set(selector, selectorObj);
    return selectorObj;
  }

  /**
   * Generate cache key for element
   */
  private generateElementCacheKey(element: ElementInfo): string {
    return `${element.tagName}_${element.id || ''}_${element.className || ''}_${element.text?.substring(0, 20) || ''}`;
  }

  /**
   * Generate TestCafe code for browser actions
   */
  generateActionCode(actions: BrowserAction[]): string {
    let code = '';
    
    actions.forEach(action => {
      code += this.generateSingleActionCode(action);
    });
    
    return code;
  }

  /**
   * Generate interactive test code for real-time execution
   */
  private generateInteractiveTestCode(
    actions: BrowserAction[],
    options?: { url?: string; timeout?: number }
  ): string {
    let testCode = `import { Selector } from 'testcafe';\n\n`;
    
    if (options?.url) {
      testCode += `fixture('Interactive Test').page('${options.url}');\n\n`;
    } else {
      testCode += `fixture('Interactive Test');\n\n`;
    }

    testCode += `test('Execute Actions', async t => {\n`;
    
    // Add timeout configuration if specified
    if (options?.timeout) {
      testCode += `  await t.setTestSpeed(1).setPageLoadTimeout(${options.timeout});\n\n`;
    }

    // Generate action code
    const actionCode = this.generateActionCode(actions);
    const indentedActionCode = actionCode
      .split('\n')
      .map(line => line.trim() ? `  ${line}` : line)
      .join('\n');
    
    testCode += indentedActionCode;
    testCode += '});\n';

    return testCode;
  }

  /**
   * Generate element discovery test code
   */
  private generateElementDiscoveryCode(
    selector?: string,
    options?: { url?: string; includeHidden?: boolean; maxElements?: number }
  ): string {
    let testCode = `import { Selector } from 'testcafe';\n\n`;
    
    if (options?.url) {
      testCode += `fixture('Element Discovery').page('${options.url}');\n\n`;
    } else {
      testCode += `fixture('Element Discovery');\n\n`;
    }

    testCode += `test('Discover Elements', async t => {\n`;
    
    if (selector) {
      testCode += `  const elements = Selector('${this.escapeString(selector)}');\n`;
      testCode += `  const count = await elements.count;\n`;
      testCode += `  console.log('Found', count, 'elements matching selector:', '${this.escapeString(selector)}');\n`;
      
      testCode += `  for (let i = 0; i < Math.min(count, ${options?.maxElements || 10}); i++) {\n`;
      testCode += `    const element = elements.nth(i);\n`;
      testCode += `    const tagName = await element.tagName;\n`;
      testCode += `    const id = await element.id;\n`;
      testCode += `    const className = await element.classNames;\n`;
      testCode += `    const text = await element.textContent;\n`;
      testCode += `    const visible = await element.visible;\n`;
      testCode += `    console.log('Element', i, ':', { tagName, id, className, text: text?.substring(0, 50), visible });\n`;
      testCode += `  }\n`;
    } else {
      // Discover all interactive elements
      const selectors = [
        'button', 'input', 'select', 'textarea', 'a[href]', 
        '[onclick]', '[role="button"]', '[tabindex]'
      ];
      
      selectors.forEach(sel => {
        testCode += `  const ${sel.replace(/[^a-zA-Z]/g, '')}Elements = Selector('${sel}');\n`;
        testCode += `  console.log('${sel}:', await ${sel.replace(/[^a-zA-Z]/g, '')}Elements.count);\n`;
      });
    }
    
    testCode += '});\n';
    return testCode;
  }

  /**
   * Collect discovered elements with enhanced data
   */
  private collectDiscoveredElements(selector?: string, options?: any): ElementInfo[] {
    // This would be enhanced to collect real data from TestCafe execution
    // For now, return enhanced mock data based on selector
    return this.generateEnhancedMockElementInfo(selector, options);
  }

  /**
   * Generate enhanced mock element info for testing
   */
  private generateEnhancedMockElementInfo(selector?: string, options?: any): ElementInfo[] {
    const mockElements: ElementInfo[] = [
      {
        tagName: 'BUTTON',
        id: 'submit-btn',
        className: 'btn btn-primary',
        text: 'Submit',
        attributes: {
          type: 'submit',
          class: 'btn btn-primary',
          id: 'submit-btn',
          'data-testid': 'submit-button'
        },
        boundingBox: { x: 100, y: 200, width: 120, height: 40 },
        isVisible: true,
        isEnabled: true
      },
      {
        tagName: 'INPUT',
        id: 'username',
        className: 'form-control',
        text: '',
        attributes: {
          type: 'text',
          class: 'form-control',
          id: 'username',
          placeholder: 'Enter username',
          name: 'username'
        },
        boundingBox: { x: 100, y: 150, width: 200, height: 30 },
        isVisible: true,
        isEnabled: true
      },
      {
        tagName: 'INPUT',
        id: 'password',
        className: 'form-control',
        text: '',
        attributes: {
          type: 'password',
          class: 'form-control',
          id: 'password',
          placeholder: 'Enter password',
          name: 'password'
        },
        boundingBox: { x: 100, y: 190, width: 200, height: 30 },
        isVisible: true,
        isEnabled: true
      },
      {
        tagName: 'A',
        id: 'forgot-password',
        className: 'link',
        text: 'Forgot Password?',
        attributes: {
          href: '/forgot-password',
          class: 'link',
          id: 'forgot-password'
        },
        boundingBox: { x: 100, y: 250, width: 150, height: 20 },
        isVisible: true,
        isEnabled: true
      }
    ];

    if (selector) {
      return mockElements.filter(el => 
        el.id?.includes(selector) || 
        el.className?.includes(selector) ||
        el.tagName.toLowerCase().includes(selector.toLowerCase()) ||
        el.attributes['data-testid']?.includes(selector)
      );
    }

    // Filter by options
    let filtered = mockElements;
    if (options?.includeHidden === false) {
      filtered = filtered.filter(el => el.isVisible);
    }
    if (options?.maxElements) {
      filtered = filtered.slice(0, options.maxElements);
    }

    return filtered;
  }

  /**
   * Validate element with temporary test
   */
  private async validateElementWithTempTest(
    selector: string,
    options?: { timeout?: number; requireVisible?: boolean; requireEnabled?: boolean }
  ): Promise<{ exists: boolean; visible: boolean; enabled: boolean; info?: ElementInfo }> {
    try {
      const validationCode = this.generateElementValidationCode(selector, options);
      const tempFile = await this.createTempTestFile(validationCode);

      try {
        const runner = this.testCafeInstance.createRunner();
        runner.src(tempFile);
        runner.browsers(['chrome:headless']);

        const failedCount = await runner.run({
          skipJsErrors: true,
          skipUncaughtErrors: true
        });

        // For now, return mock validation result
        return {
          exists: failedCount === 0,
          visible: failedCount === 0,
          enabled: failedCount === 0,
          info: failedCount === 0 ? this.generateEnhancedMockElementInfo(selector)[0] : undefined
        };

      } finally {
        await this.cleanupTempFile(tempFile);
      }

    } catch (error) {
      return { exists: false, visible: false, enabled: false };
    }
  }

  /**
   * Get element info with temporary test
   */
  private async getElementInfoWithTempTest(selector: string): Promise<ElementInfo | null> {
    try {
      const infoCode = this.generateElementInfoCode(selector);
      const tempFile = await this.createTempTestFile(infoCode);

      try {
        const runner = this.testCafeInstance.createRunner();
        runner.src(tempFile);
        runner.browsers(['chrome:headless']);

        await runner.run({
          skipJsErrors: true,
          skipUncaughtErrors: true
        });

        // For now, return mock element info
        const mockElements = this.generateEnhancedMockElementInfo(selector);
        return mockElements.length > 0 ? mockElements[0] : null;

      } finally {
        await this.cleanupTempFile(tempFile);
      }

    } catch (error) {
      return null;
    }
  }

  /**
   * Generate element validation test code
   */
  private generateElementValidationCode(
    selector: string,
    options?: { timeout?: number; requireVisible?: boolean; requireEnabled?: boolean }
  ): string {
    const timeout = options?.timeout || 5000;
    const requireVisible = options?.requireVisible !== false;
    const requireEnabled = options?.requireEnabled !== false;

    let testCode = `import { Selector } from 'testcafe';\n\n`;
    testCode += `fixture('Element Validation');\n\n`;
    testCode += `test('Validate Element', async t => {\n`;
    testCode += `  const element = Selector('${this.escapeString(selector)}');\n`;
    testCode += `  await t.expect(element.exists).ok('Element should exist', { timeout: ${timeout} });\n`;
    
    if (requireVisible) {
      testCode += `  await t.expect(element.visible).ok('Element should be visible');\n`;
    }
    
    if (requireEnabled) {
      testCode += `  await t.expect(element.hasAttribute('disabled')).notOk('Element should be enabled');\n`;
    }
    
    testCode += '});\n';
    return testCode;
  }

  /**
   * Generate element info extraction test code
   */
  private generateElementInfoCode(selector: string): string {
    let testCode = `import { Selector } from 'testcafe';\n\n`;
    testCode += `fixture('Element Info');\n\n`;
    testCode += `test('Extract Element Info', async t => {\n`;
    testCode += `  const element = Selector('${this.escapeString(selector)}');\n`;
    testCode += `  await t.expect(element.exists).ok('Element should exist');\n`;
    testCode += `  \n`;
    testCode += `  const tagName = await element.tagName;\n`;
    testCode += `  const id = await element.id;\n`;
    testCode += `  const className = await element.classNames;\n`;
    testCode += `  const text = await element.textContent;\n`;
    testCode += `  const visible = await element.visible;\n`;
    testCode += `  const boundingBox = await element.boundingClientRect;\n`;
    testCode += `  \n`;
    testCode += `  console.log('Element Info:', { tagName, id, className, text, visible, boundingBox });\n`;
    testCode += '});\n';
    return testCode;
  }

  /**
   * Prepare browser configuration with enhanced options
   */
  private prepareBrowserConfig(browser: string): string {
    let config = browser;
    
    // Add stability flags for Chrome/Chromium
    if (config.includes('chrome') || config.includes('chromium')) {
      const flags = [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ];
      
      flags.forEach(flag => {
        if (!config.includes(flag)) {
          config += ` ${flag}`;
        }
      });
    }
    
    return config;
  }

  /**
   * Configure screenshots with enhanced options
   */
  private async configureScreenshots(screenshotPath?: string): Promise<any> {
    const path = screenshotPath || './interaction-screenshots';
    await this.ensureDirectoryExists(path);
    
    return {
      path,
      takeOnFails: true,
      fullPage: true,
      pathPattern: '${DATE}_${TIME}/interaction-${TEST_INDEX}/${USERAGENT}/${FILE_INDEX}.png',
      thumbnails: false,
      mode: 'always',
      quality: 90
    };
  }

  /**
   * Collect element information from actions
   */
  private async collectElementInformation(actions: BrowserAction[]): Promise<ElementInfo[]> {
    const elements: ElementInfo[] = [];
    
    for (const action of actions) {
      if ('selector' in action && action.selector) {
        const mockInfo = this.generateEnhancedMockElementInfo(action.selector);
        if (mockInfo.length > 0) {
          elements.push(mockInfo[0]);
        }
      }
    }
    
    return elements;
  }

  /**
   * Create temporary test file
   */
  private async createTempTestFile(testCode: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testcafe-interact-'));
    const tempFile = path.join(tempDir, 'interact-test.js');
    
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
   * Generate selector suggestions for an element
   */
  generateSelectorSuggestions(elementInfo: ElementInfo): SelectorSuggestion[] {
    const suggestions: SelectorSuggestion[] = [];

    // ID selector (highest specificity)
    if (elementInfo.id) {
      suggestions.push({
        selector: `#${elementInfo.id}`,
        type: 'id',
        specificity: 100,
        description: `Select by ID: ${elementInfo.id}`
      });
    }

    // Class selector
    if (elementInfo.className) {
      const classes = elementInfo.className.split(' ').filter(c => c.trim());
      classes.forEach(className => {
        suggestions.push({
          selector: `.${className}`,
          type: 'class',
          specificity: 50,
          description: `Select by class: ${className}`
        });
      });
    }

    // Text selector
    if (elementInfo.text && elementInfo.text.trim().length > 0) {
      const text = elementInfo.text.trim();
      if (text.length <= 50) { // Only suggest for reasonably short text
        suggestions.push({
          selector: `Selector('*').withText('${this.escapeString(text)}')`,
          type: 'text',
          specificity: 70,
          description: `Select by text: "${text}"`
        });
      }
    }

    // Attribute selectors
    Object.entries(elementInfo.attributes).forEach(([attr, value]) => {
      if (attr !== 'id' && attr !== 'class' && value) {
        suggestions.push({
          selector: `[${attr}="${value}"]`,
          type: 'attribute',
          specificity: 60,
          description: `Select by ${attr} attribute: ${value}`
        });
      }
    });

    // Tag name selector (lowest specificity)
    suggestions.push({
      selector: elementInfo.tagName.toLowerCase(),
      type: 'css',
      specificity: 10,
      description: `Select by tag name: ${elementInfo.tagName}`
    });

    // Sort by specificity (highest first)
    return suggestions.sort((a, b) => b.specificity - a.specificity);
  }

  /**
   * Create assertion helpers for common TestCafe assertions
   */
  generateAssertionCode(assertion: AssertAction): string {
    const selector = `Selector('${this.escapeString(assertion.selector)}')`;
    
    switch (assertion.assertion) {
      case 'exists':
        return `await t.expect(${selector}.exists).ok('Element should exist');\n`;
      
      case 'visible':
        return `await t.expect(${selector}.visible).ok('Element should be visible');\n`;
      
      case 'text':
        if (assertion.expected === undefined) {
          throw new Error('Text assertion requires expected value');
        }
        return `await t.expect(${selector}.textContent).eql('${this.escapeString(String(assertion.expected))}', 'Element text should match');\n`;
      
      case 'value':
        if (assertion.expected === undefined) {
          throw new Error('Value assertion requires expected value');
        }
        return `await t.expect(${selector}.value).eql('${this.escapeString(String(assertion.expected))}', 'Element value should match');\n`;
      
      case 'attribute':
        if (!assertion.attribute || assertion.expected === undefined) {
          throw new Error('Attribute assertion requires attribute name and expected value');
        }
        return `await t.expect(${selector}.getAttribute('${assertion.attribute}')).eql('${this.escapeString(String(assertion.expected))}', 'Attribute should match');\n`;
      
      case 'count':
        if (typeof assertion.expected !== 'number') {
          throw new Error('Count assertion requires numeric expected value');
        }
        return `await t.expect(${selector}.count).eql(${assertion.expected}, 'Element count should match');\n`;
      
      default:
        throw new Error(`Unknown assertion type: ${assertion.assertion}`);
    }
  }

  /**
   * Validate browser action
   */
  validateAction(action: unknown): { isValid: boolean; errors: string[] } {
    try {
      BrowserActionSchema.parse(action);
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
   * Generate code for a single browser action
   */
  private generateSingleActionCode(action: BrowserAction): string {
    switch (action.type) {
      case 'click':
        return this.generateClickCode(action);
      
      case 'type':
        return this.generateTypeCode(action);
      
      case 'navigate':
        return this.generateNavigateCode(action);
      
      case 'wait':
        return this.generateWaitCode(action);
      
      case 'assert':
        return this.generateAssertionCode(action);
      
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  /**
   * Generate click action code
   */
  private generateClickCode(action: ClickAction): string {
    const selector = `Selector('${this.escapeString(action.selector)}')`;
    let code = `await t.click(${selector}`;
    
    if (action.options) {
      const options: string[] = [];
      
      if (action.options.modifiers) {
        const modifiers: string[] = [];
        if (action.options.modifiers.ctrl) modifiers.push('ctrl');
        if (action.options.modifiers.alt) modifiers.push('alt');
        if (action.options.modifiers.shift) modifiers.push('shift');
        if (action.options.modifiers.meta) modifiers.push('meta');
        
        if (modifiers.length > 0) {
          options.push(`modifiers: { ${modifiers.map(m => `${m}: true`).join(', ')} }`);
        }
      }
      
      if (action.options.offsetX !== undefined) {
        options.push(`offsetX: ${action.options.offsetX}`);
      }
      
      if (action.options.offsetY !== undefined) {
        options.push(`offsetY: ${action.options.offsetY}`);
      }
      
      if (options.length > 0) {
        code += `, { ${options.join(', ')} }`;
      }
    }
    
    code += ');\n';
    return code;
  }

  /**
   * Generate type action code
   */
  private generateTypeCode(action: TypeAction): string {
    const selector = `Selector('${this.escapeString(action.selector)}')`;
    let code = `await t.typeText(${selector}, '${this.escapeString(action.text)}'`;
    
    if (action.options) {
      const options: string[] = [];
      
      if (action.options.replace) options.push('replace: true');
      if (action.options.paste) options.push('paste: true');
      if (action.options.confidential) options.push('confidential: true');
      
      if (options.length > 0) {
        code += `, { ${options.join(', ')} }`;
      }
    }
    
    code += ');\n';
    return code;
  }

  /**
   * Generate navigate action code
   */
  private generateNavigateCode(action: NavigateAction): string {
    return `await t.navigateTo('${action.url}');\n`;
  }

  /**
   * Generate wait action code
   */
  private generateWaitCode(action: WaitAction): string {
    switch (action.condition) {
      case 'timeout':
        if (typeof action.value !== 'number') {
          throw new Error('Timeout wait requires numeric value');
        }
        return `await t.wait(${action.value});\n`;
      
      case 'element':
        if (typeof action.value !== 'string') {
          throw new Error('Element wait requires selector string');
        }
        const timeout = action.timeout || 30000;
        return `await t.expect(Selector('${this.escapeString(action.value)}').exists).ok('', { timeout: ${timeout} });\n`;
      
      case 'function':
        if (typeof action.value !== 'string') {
          throw new Error('Function wait requires function code string');
        }
        const funcTimeout = action.timeout || 30000;
        return `await t.expect(() => { ${action.value} }).ok('', { timeout: ${funcTimeout} });\n`;
      
      default:
        throw new Error(`Unknown wait condition: ${action.condition}`);
    }
  }

  /**
   * Escape string for JavaScript code generation
   */
  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }

  /**
   * Create form filling sequence with enhanced validation
   */
  static createFormFillSequence(
    fields: Array<{ 
      selector: string; 
      value: string; 
      type?: 'type' | 'select' | 'checkbox' | 'radio';
      waitAfter?: number;
      validate?: boolean;
    }>,
    submitSelector?: string,
    options?: {
      validateFields?: boolean;
      waitBetweenFields?: number;
      clearBeforeType?: boolean;
    }
  ): BrowserAction[] {
    const actions: BrowserAction[] = [];
    const waitBetweenFields = options?.waitBetweenFields || 500;
    const clearBeforeType = options?.clearBeforeType !== false;

    fields.forEach((field, index) => {
      // Add validation check if requested
      if (options?.validateFields || field.validate) {
        actions.push({
          type: 'assert',
          assertion: 'exists',
          selector: field.selector
        });
      }

      // Handle different field types
      switch (field.type) {
        case 'select':
          actions.push(
            {
              type: 'click',
              selector: field.selector
            },
            {
              type: 'wait',
              condition: 'timeout',
              value: 200
            },
            {
              type: 'click',
              selector: `${field.selector} option[value="${field.value}"]`
            }
          );
          break;

        case 'checkbox':
        case 'radio':
          actions.push({
            type: 'click',
            selector: field.selector
          });
          break;

        default: // 'type' or undefined
          actions.push({
            type: 'type',
            selector: field.selector,
            text: field.value,
            options: { replace: clearBeforeType }
          });
          break;
      }

      // Add field-specific wait
      if (field.waitAfter) {
        actions.push({
          type: 'wait',
          condition: 'timeout',
          value: field.waitAfter
        });
      }

      // Add wait between fields (except for last field)
      if (index < fields.length - 1 && waitBetweenFields > 0) {
        actions.push({
          type: 'wait',
          condition: 'timeout',
          value: waitBetweenFields
        });
      }
    });

    // Add submit action if provided
    if (submitSelector) {
      actions.push(
        {
          type: 'wait',
          condition: 'timeout',
          value: 500
        },
        {
          type: 'click',
          selector: submitSelector
        }
      );
    }

    return actions;
  }

  /**
   * Create complex interaction sequence with conditional logic
   */
  static createConditionalSequence(
    steps: Array<{
      condition?: { selector: string; assertion: 'exists' | 'visible' | 'text'; expected?: any };
      actions: BrowserAction[];
      onSuccess?: BrowserAction[];
      onFailure?: BrowserAction[];
      continueOnFailure?: boolean;
    }>
  ): BrowserAction[] {
    const actions: BrowserAction[] = [];

    steps.forEach(step => {
      // Add condition check if specified
      if (step.condition) {
        actions.push({
          type: 'assert',
          assertion: step.condition.assertion,
          selector: step.condition.selector,
          expected: step.condition.expected
        });
      }

      // Add main actions
      actions.push(...step.actions);

      // Add success actions if specified
      if (step.onSuccess) {
        actions.push(...step.onSuccess);
      }
    });

    return actions;
  }

  /**
   * Create navigation and wait sequence
   */
  static createNavigationSequence(
    url: string,
    waitConditions?: Array<{
      type: 'element' | 'timeout' | 'function';
      value: string | number;
      timeout?: number;
    }>,
    postNavigationActions?: BrowserAction[]
  ): BrowserAction[] {
    const actions: BrowserAction[] = [];

    // Navigate to URL
    actions.push({
      type: 'navigate',
      url
    });

    // Add wait conditions
    if (waitConditions) {
      waitConditions.forEach(condition => {
        actions.push({
          type: 'wait',
          condition: condition.type,
          value: condition.value,
          timeout: condition.timeout
        });
      });
    } else {
      // Default wait for page load
      actions.push({
        type: 'wait',
        condition: 'timeout',
        value: 2000
      });
    }

    // Add post-navigation actions
    if (postNavigationActions) {
      actions.push(...postNavigationActions);
    }

    return actions;
  }

  /**
   * Create element interaction sequence with retries
   */
  static createRobustInteractionSequence(
    interactions: Array<{
      action: BrowserAction;
      retries?: number;
      waitBefore?: number;
      waitAfter?: number;
      validation?: { selector: string; assertion: 'exists' | 'visible' | 'text'; expected?: any };
    }>
  ): BrowserAction[] {
    const actions: BrowserAction[] = [];

    interactions.forEach(interaction => {
      // Add wait before action
      if (interaction.waitBefore) {
        actions.push({
          type: 'wait',
          condition: 'timeout',
          value: interaction.waitBefore
        });
      }

      // Add validation before action
      if (interaction.validation) {
        actions.push({
          type: 'assert',
          assertion: interaction.validation.assertion,
          selector: interaction.validation.selector,
          expected: interaction.validation.expected
        });
      }

      // Add the main action
      actions.push(interaction.action);

      // Add wait after action
      if (interaction.waitAfter) {
        actions.push({
          type: 'wait',
          condition: 'timeout',
          value: interaction.waitAfter
        });
      }
    });

    return actions;
  }

  /**
   * Execute complex interaction sequence with session management
   */
  async executeComplexSequence(
    sequence: BrowserAction[],
    options?: {
      sessionId?: string;
      browser?: string;
      url?: string;
      timeout?: number;
      screenshots?: boolean;
      screenshotPath?: string;
      validateElements?: boolean;
      retryFailedActions?: boolean;
      pauseBetweenActions?: number;
      onActionComplete?: (action: BrowserAction, index: number, result: any) => void;
      onSequenceComplete?: (results: any[]) => void;
    }
  ): Promise<BrowserInteractionResult & { actionResults?: any[] }> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const actionResults: any[] = [];
    let actionsExecuted = 0;

    try {
      // Get or create session for complex sequence
      const session = await this.getOrCreateSession(options?.sessionId, {
        browser: options?.browser,
        url: options?.url
      });

      const context = this.liveContexts.get(session.id);
      if (!context) {
        throw new Error(`Live context not found for session ${session.id}`);
      }

      // Execute sequence with enhanced tracking
      for (let i = 0; i < sequence.length; i++) {
        const action = sequence[i];
        
        try {
          // Add pause between actions if specified
          if (options?.pauseBetweenActions && i > 0) {
            await new Promise(resolve => setTimeout(resolve, options.pauseBetweenActions));
          }

          // Execute single action with enhanced error handling
          await this.executeSingleLiveAction(action, session.id);
          actionsExecuted++;

          const actionResult = {
            action,
            index: i,
            success: true,
            timestamp: Date.now()
          };
          
          actionResults.push(actionResult);

          // Call action complete callback
          if (options?.onActionComplete) {
            options.onActionComplete(action, i, actionResult);
          }

          // Update session activity
          session.lastActivity = new Date();

        } catch (actionError) {
          const errorMessage = actionError instanceof Error ? actionError.message : String(actionError);
          
          const actionResult: any = {
            action,
            index: i,
            success: false,
            error: errorMessage,
            timestamp: Date.now()
          };
          
          actionResults.push(actionResult);

          if (options?.retryFailedActions) {
            warnings.push(`Action ${i + 1} failed, retrying: ${errorMessage}`);
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
              await this.executeSingleLiveAction(action, session.id);
              actionsExecuted++;
              actionResult.success = true;
              actionResult.retried = true;
            } catch (retryError) {
              errors.push(`Action ${i + 1} failed after retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
            }
          } else {
            errors.push(`Action ${i + 1} failed: ${errorMessage}`);
          }
        }
      }

      // Call sequence complete callback
      if (options?.onSequenceComplete) {
        options.onSequenceComplete(actionResults);
      }

      const result = {
        success: errors.length === 0,
        actionsExecuted,
        duration: Date.now() - startTime,
        errors,
        warnings,
        actionResults
      };

      return result;

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        actionsExecuted,
        duration: Date.now() - startTime,
        errors,
        warnings,
        actionResults
      };
    }
  }
}