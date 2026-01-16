/**
 * Tab Management Service
 *
 * Provides browser tab/window management functionality.
 * Note: TestCafe manages "windows" rather than traditional browser tabs.
 */

import { z } from 'zod';

/**
 * Tab/window information
 */
export interface TabInfo {
  id: string;
  url: string;
  title: string;
  isActive: boolean;
  index: number;
}

/**
 * Tab management result
 */
export interface TabManagementResult {
  operation: string;
  success: boolean;
  tabs?: TabInfo[];
  activeTab?: TabInfo;
  createdTab?: TabInfo;
  closedTabId?: string;
  error?: string;
  executionTime: number;
}

/**
 * Tab management options schema
 */
export const TabManagementOptionsSchema = z.object({
  operation: z.enum(['list', 'create', 'close', 'switch']).describe('Tab operation to perform'),
  url: z.string().url().optional().describe('URL for creating new tab'),
  tabId: z.string().optional().describe('Tab/window ID for close/switch operations'),
  browser: z.string().default('chrome:headless').describe('Browser to use'),
  waitForLoad: z.boolean().default(true).describe('Wait for page load after navigation'),
  timeout: z.number().min(1000).max(60000).default(30000).describe('Operation timeout in ms')
});

export type TabManagementOptions = z.infer<typeof TabManagementOptionsSchema>;

/**
 * Tab Management Service
 *
 * Handles browser tab/window management using TestCafe.
 */
export class TabManagementService {
  private testCafeInstance: any = null;
  private windowRegistry: Map<string, { index: number; url: string; title: string }> = new Map();
  private windowCounter: number = 0;

  /**
   * Initialize the tab management service with TestCafe instance
   */
  async initialize(testCafeInstance?: any): Promise<void> {
    if (testCafeInstance) {
      this.testCafeInstance = testCafeInstance;
    } else {
      const createTestCafe = (await import('testcafe')).default;
      this.testCafeInstance = await createTestCafe('localhost', 1341, 1342);
    }
  }

  /**
   * Close the tab management service
   */
  async close(): Promise<void> {
    if (this.testCafeInstance) {
      await this.testCafeInstance.close();
      this.testCafeInstance = null;
    }
    this.windowRegistry.clear();
    this.windowCounter = 0;
  }

  /**
   * List all open tabs/windows
   */
  async listTabs(options: { browser?: string; initialUrl?: string }): Promise<TabInfo[]> {
    if (!this.testCafeInstance) {
      await this.initialize();
    }

    const testCode = this.generateListTabsCode(options.initialUrl || 'about:blank');
    const tempFile = await this.createTempTestFile(testCode);

    try {
      const result = await this.executeTabOperation(tempFile, options.browser);
      return result.tabs || [];
    } finally {
      await this.cleanupTempFile(tempFile);
    }
  }

  /**
   * Create a new tab/window
   */
  async createTab(url: string, options?: { browser?: string; waitForLoad?: boolean }): Promise<TabInfo> {
    if (!this.testCafeInstance) {
      await this.initialize();
    }

    const testCode = this.generateCreateTabCode(url, options?.waitForLoad ?? true);
    const tempFile = await this.createTempTestFile(testCode);

    try {
      const result = await this.executeTabOperation(tempFile, options?.browser);
      if (result.createdTab) {
        // Register the new window
        const tabId = result.createdTab.id;
        this.windowRegistry.set(tabId, {
          index: this.windowCounter++,
          url: result.createdTab.url,
          title: result.createdTab.title
        });
        return result.createdTab;
      }
      throw new Error('Failed to create tab');
    } finally {
      await this.cleanupTempFile(tempFile);
    }
  }

  /**
   * Close a tab/window
   */
  async closeTab(tabId: string, options?: { browser?: string }): Promise<boolean> {
    if (!this.testCafeInstance) {
      await this.initialize();
    }

    const testCode = this.generateCloseTabCode(tabId);
    const tempFile = await this.createTempTestFile(testCode);

    try {
      const result = await this.executeTabOperation(tempFile, options?.browser);
      if (result.success) {
        this.windowRegistry.delete(tabId);
      }
      return result.success;
    } finally {
      await this.cleanupTempFile(tempFile);
    }
  }

  /**
   * Switch to a tab/window
   */
  async switchTab(tabId: string, options?: { browser?: string }): Promise<TabInfo> {
    if (!this.testCafeInstance) {
      await this.initialize();
    }

    const testCode = this.generateSwitchTabCode(tabId);
    const tempFile = await this.createTempTestFile(testCode);

    try {
      const result = await this.executeTabOperation(tempFile, options?.browser);
      if (result.activeTab) {
        return result.activeTab;
      }
      throw new Error('Failed to switch to tab: ' + tabId);
    } finally {
      await this.cleanupTempFile(tempFile);
    }
  }

  /**
   * Get current active tab
   */
  async getCurrentTab(options?: { browser?: string }): Promise<TabInfo | null> {
    if (!this.testCafeInstance) {
      await this.initialize();
    }

    const testCode = this.generateGetCurrentTabCode();
    const tempFile = await this.createTempTestFile(testCode);

    try {
      const result = await this.executeTabOperation(tempFile, options?.browser);
      return result.activeTab || null;
    } finally {
      await this.cleanupTempFile(tempFile);
    }
  }

  /**
   * Generate TestCafe code for listing tabs
   */
  private generateListTabsCode(initialUrl: string): string {
    return `import { Selector } from 'testcafe';

fixture('Tab Management - List')
  .page('${this.escapeString(initialUrl)}');

test('List Open Windows', async t => {
  // Get current window info
  const windowInfo = await t.eval(() => {
    return {
      url: window.location.href,
      title: document.title
    };
  });

  // In TestCafe, we can't enumerate all windows directly
  // We return the current window information
  const tabs = [{
    id: 'main_window',
    url: windowInfo.url,
    title: windowInfo.title,
    isActive: true,
    index: 0
  }];

  console.log('TAB_LIST_RESULT:', JSON.stringify({ tabs }));
});`;
  }

  /**
   * Generate TestCafe code for creating a new tab
   */
  private generateCreateTabCode(url: string, waitForLoad: boolean): string {
    return `import { Selector } from 'testcafe';

fixture('Tab Management - Create')
  .page('about:blank');

test('Create New Tab', async t => {
  // Open new window
  const newWindow = await t.openWindow('${this.escapeString(url)}');

  ${waitForLoad ? `
  // Wait for page to load
  await t.wait(1000);
  await t.expect(Selector(() => document.readyState === 'complete').exists).ok('Page should be ready', {
    timeout: 30000
  });
  ` : ''}

  // Get window info
  const windowInfo = await t.eval(() => {
    return {
      url: window.location.href,
      title: document.title
    };
  });

  const tabId = 'window_' + Date.now();

  const result = {
    createdTab: {
      id: tabId,
      url: windowInfo.url,
      title: windowInfo.title,
      isActive: true,
      index: 1
    },
    success: true
  };

  console.log('TAB_CREATE_RESULT:', JSON.stringify(result));
});`;
  }

  /**
   * Generate TestCafe code for closing a tab
   */
  private generateCloseTabCode(tabId: string): string {
    return `import { Selector } from 'testcafe';

fixture('Tab Management - Close')
  .page('about:blank');

test('Close Window', async t => {
  // Note: TestCafe doesn't support closing arbitrary windows by ID
  // We can only close windows we've opened and tracked
  // This is a limitation of TestCafe's window management

  // For the main window, we can't close it
  if ('${tabId}' === 'main_window') {
    console.log('TAB_CLOSE_RESULT:', JSON.stringify({
      success: false,
      error: 'Cannot close the main window',
      closedTabId: null
    }));
    return;
  }

  // For other windows, we would need to track them during creation
  // and use t.closeWindow() with the window descriptor

  // Since we can't close an arbitrary window without its descriptor,
  // we return an error indicating this limitation
  console.log('TAB_CLOSE_RESULT:', JSON.stringify({
    success: false,
    error: 'Cannot close window without window descriptor. Use closeWindow with the window object from openWindow.',
    closedTabId: '${tabId}'
  }));
});`;
  }

  /**
   * Generate TestCafe code for switching tabs
   */
  private generateSwitchTabCode(tabId: string): string {
    return `import { Selector } from 'testcafe';

fixture('Tab Management - Switch')
  .page('about:blank');

test('Switch to Window', async t => {
  // Note: TestCafe requires the window descriptor to switch
  // This is obtained when opening a window with t.openWindow()

  if ('${tabId}' === 'main_window') {
    // Switch to parent window
    await t.switchToParentWindow();

    const windowInfo = await t.eval(() => {
      return {
        url: window.location.href,
        title: document.title
      };
    });

    console.log('TAB_SWITCH_RESULT:', JSON.stringify({
      success: true,
      activeTab: {
        id: 'main_window',
        url: windowInfo.url,
        title: windowInfo.title,
        isActive: true,
        index: 0
      }
    }));
    return;
  }

  // For other windows, we need the window descriptor
  console.log('TAB_SWITCH_RESULT:', JSON.stringify({
    success: false,
    error: 'Cannot switch to window without window descriptor. Use switchToWindow with the window object from openWindow.',
    activeTab: null
  }));
});`;
  }

  /**
   * Generate TestCafe code for getting current tab
   */
  private generateGetCurrentTabCode(): string {
    return `import { Selector } from 'testcafe';

fixture('Tab Management - Get Current')
  .page('about:blank');

test('Get Current Window', async t => {
  const windowInfo = await t.eval(() => {
    return {
      url: window.location.href,
      title: document.title
    };
  });

  const result = {
    success: true,
    activeTab: {
      id: 'current_window',
      url: windowInfo.url,
      title: windowInfo.title,
      isActive: true,
      index: 0
    }
  };

  console.log('TAB_CURRENT_RESULT:', JSON.stringify(result));
});`;
  }

  /**
   * Execute tab operation in TestCafe
   */
  private async executeTabOperation(
    tempFile: string,
    browser?: string
  ): Promise<{ success: boolean; tabs?: TabInfo[]; activeTab?: TabInfo; createdTab?: TabInfo; error?: string }> {
    const runner = this.testCafeInstance.createRunner();
    runner.src(tempFile);
    runner.browsers([browser || 'chrome:headless']);

    let capturedOutput = '';
    const originalLog = console.log;

    console.log = (...args: any[]) => {
      const message = args.join(' ');
      capturedOutput += message + '\n';
    };

    try {
      await runner.run({
        skipJsErrors: true,
        skipUncaughtErrors: true,
        quarantineMode: false,
        selectorTimeout: 5000,
        assertionTimeout: 5000,
        pageLoadTimeout: 30000
      });
    } finally {
      console.log = originalLog;
    }

    // Parse result from output
    const resultPatterns = [
      /TAB_LIST_RESULT: (.+)/,
      /TAB_CREATE_RESULT: (.+)/,
      /TAB_CLOSE_RESULT: (.+)/,
      /TAB_SWITCH_RESULT: (.+)/,
      /TAB_CURRENT_RESULT: (.+)/
    ];

    for (const pattern of resultPatterns) {
      const match = capturedOutput.match(pattern);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch {
          // Continue to next pattern
        }
      }
    }

    return { success: false, error: 'No result captured' };
  }

  /**
   * Generate tab management code for manual use
   */
  generateTabManagementCode(operation: string, options: Partial<TabManagementOptions>): string {
    switch (operation) {
      case 'list':
        return this.generateListTabsCode(options.url || 'about:blank');
      case 'create':
        return this.generateCreateTabCode(options.url || 'about:blank', options.waitForLoad ?? true);
      case 'close':
        return this.generateCloseTabCode(options.tabId || '');
      case 'switch':
        return this.generateSwitchTabCode(options.tabId || '');
      default:
        return this.generateGetCurrentTabCode();
    }
  }

  /**
   * Create temporary test file
   */
  private async createTempTestFile(testCode: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testcafe-tabs-'));
    const tempFile = path.join(tempDir, 'tab-management-test.js');

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
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Escape string for JavaScript
   */
  private escapeString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }
}
