/**
 * Accessibility Service
 *
 * Provides accessibility tree extraction functionality for LLM-friendly page analysis.
 * Returns structured data about page content (roles, labels, states) without requiring vision.
 */

import { z } from 'zod';

/**
 * Accessibility node in the tree
 */
export interface AccessibilityNode {
  role: string;
  name: string;
  value?: string;
  description?: string;
  states: string[];
  properties: Record<string, string | boolean | number>;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children?: AccessibilityNode[];
  selector?: string;
  level?: number;  // For headings
}

/**
 * Accessibility snapshot result
 */
export interface AccessibilitySnapshotResult {
  tree: AccessibilityNode;
  summary: {
    totalNodes: number;
    roleDistribution: Record<string, number>;
    landmarks: string[];
    headingStructure: { level: number; text: string }[];
    interactiveElements: number;
    warnings: string[];
  };
  pageInfo: {
    title: string;
    url: string;
    language: string;
  };
  captureTime: number;
}

/**
 * Accessibility snapshot options schema
 */
export const AccessibilitySnapshotOptionsSchema = z.object({
  url: z.string().url().describe('The URL of the page to analyze'),
  selector: z.string().optional().describe('Optional CSS selector for root element'),
  includeHidden: z.boolean().default(false).describe('Include hidden elements'),
  maxDepth: z.number().min(1).max(20).default(10).describe('Maximum depth to traverse'),
  browser: z.string().default('chrome:headless').describe('Browser to use'),
  waitTime: z.number().min(100).max(60000).default(2000).describe('Wait time after page load in ms'),
  includeRoles: z.array(z.string()).optional().describe('Filter by specific ARIA roles'),
  excludeRoles: z.array(z.string()).optional().describe('Exclude specific ARIA roles')
});

export type AccessibilitySnapshotOptions = z.infer<typeof AccessibilitySnapshotOptionsSchema>;

/**
 * Accessibility Service
 *
 * Handles accessibility tree extraction for pages using TestCafe.
 */
export class AccessibilityService {
  private testCafeInstance: any = null;

  /**
   * Initialize the accessibility service with TestCafe instance
   */
  async initialize(testCafeInstance?: any): Promise<void> {
    if (testCafeInstance) {
      this.testCafeInstance = testCafeInstance;
    } else {
      const createTestCafe = (await import('testcafe')).default;
      this.testCafeInstance = await createTestCafe('localhost', 1339, 1340);
    }
  }

  /**
   * Close the accessibility service
   */
  async close(): Promise<void> {
    if (this.testCafeInstance) {
      await this.testCafeInstance.close();
      this.testCafeInstance = null;
    }
  }

  /**
   * Get accessibility snapshot of a page
   */
  async getAccessibilitySnapshot(options: AccessibilitySnapshotOptions): Promise<AccessibilitySnapshotResult> {
    const startTime = Date.now();

    if (!this.testCafeInstance) {
      await this.initialize();
    }

    const testCode = this.generateAccessibilityTreeCode(options);
    const tempFile = await this.createTempTestFile(testCode);

    try {
      const result = await this.executeAccessibilityCapture(tempFile, options);
      return {
        ...result,
        captureTime: Date.now() - startTime
      };
    } finally {
      await this.cleanupTempFile(tempFile);
    }
  }

  /**
   * Generate TestCafe code for accessibility tree extraction
   */
  private generateAccessibilityTreeCode(options: AccessibilitySnapshotOptions): string {
    const includeHidden = options.includeHidden ? 'true' : 'false';
    const maxDepth = options.maxDepth;
    const rootSelector = options.selector ? `'${this.escapeString(options.selector)}'` : 'null';
    const includeRoles = options.includeRoles ? JSON.stringify(options.includeRoles) : 'null';
    const excludeRoles = options.excludeRoles ? JSON.stringify(options.excludeRoles) : 'null';

    return `import { Selector, ClientFunction } from 'testcafe';

fixture('Accessibility Snapshot')
  .page('${this.escapeString(options.url)}');

test('Capture Accessibility Tree', async t => {
  // Wait for page to load
  await t.wait(${options.waitTime});

  // Wait for document ready state
  await t.expect(Selector(() => document.readyState === 'complete').exists).ok('Page should be ready', {
    timeout: 30000
  });

  // Capture accessibility tree
  const result = await t.eval(() => {
    const includeHidden = ${includeHidden};
    const maxDepth = ${maxDepth};
    const rootSelector = ${rootSelector};
    const includeRoles = ${includeRoles};
    const excludeRoles = ${excludeRoles};

    // Implicit role mapping for HTML elements
    const implicitRoleMap = {
      'a': (el) => el.href ? 'link' : null,
      'article': () => 'article',
      'aside': () => 'complementary',
      'button': () => 'button',
      'datalist': () => 'listbox',
      'details': () => 'group',
      'dialog': () => 'dialog',
      'footer': (el) => {
        const parent = el.parentElement;
        if (parent && ['article', 'aside', 'main', 'nav', 'section'].includes(parent.tagName.toLowerCase())) {
          return null;
        }
        return 'contentinfo';
      },
      'form': () => 'form',
      'h1': () => 'heading',
      'h2': () => 'heading',
      'h3': () => 'heading',
      'h4': () => 'heading',
      'h5': () => 'heading',
      'h6': () => 'heading',
      'header': (el) => {
        const parent = el.parentElement;
        if (parent && ['article', 'aside', 'main', 'nav', 'section'].includes(parent.tagName.toLowerCase())) {
          return null;
        }
        return 'banner';
      },
      'hr': () => 'separator',
      'img': (el) => el.alt ? 'img' : 'presentation',
      'input': (el) => {
        const type = el.type?.toLowerCase() || 'text';
        const inputRoles = {
          'button': 'button',
          'checkbox': 'checkbox',
          'email': 'textbox',
          'image': 'button',
          'number': 'spinbutton',
          'radio': 'radio',
          'range': 'slider',
          'reset': 'button',
          'search': 'searchbox',
          'submit': 'button',
          'tel': 'textbox',
          'text': 'textbox',
          'url': 'textbox',
          'password': 'textbox'
        };
        return inputRoles[type] || 'textbox';
      },
      'li': () => 'listitem',
      'main': () => 'main',
      'menu': () => 'menu',
      'nav': () => 'navigation',
      'ol': () => 'list',
      'option': () => 'option',
      'output': () => 'status',
      'progress': () => 'progressbar',
      'section': (el) => el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ? 'region' : null,
      'select': (el) => el.multiple ? 'listbox' : 'combobox',
      'summary': () => 'button',
      'table': () => 'table',
      'tbody': () => 'rowgroup',
      'td': () => 'cell',
      'textarea': () => 'textbox',
      'tfoot': () => 'rowgroup',
      'th': () => 'columnheader',
      'thead': () => 'rowgroup',
      'tr': () => 'row',
      'ul': () => 'list'
    };

    // Get the computed role for an element
    function getRole(element) {
      // Explicit role takes precedence
      const explicitRole = element.getAttribute('role');
      if (explicitRole) return explicitRole;

      // Get implicit role based on tag name
      const tagName = element.tagName.toLowerCase();
      const roleGetter = implicitRoleMap[tagName];
      if (roleGetter) {
        const role = roleGetter(element);
        if (role) return role;
      }

      // Default to generic for unknown elements
      return 'generic';
    }

    // Get accessible name for an element
    function getAccessibleName(element) {
      // aria-label takes precedence
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;

      // aria-labelledby
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelElement = document.getElementById(labelledBy);
        if (labelElement) return labelElement.textContent?.trim() || '';
      }

      // For inputs, check associated label
      if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
        if (element.id) {
          const label = document.querySelector('label[for="' + element.id + '"]');
          if (label) return label.textContent?.trim() || '';
        }
        // Check for wrapped label
        const parentLabel = element.closest('label');
        if (parentLabel) {
          const labelText = Array.from(parentLabel.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent?.trim())
            .join(' ');
          if (labelText) return labelText;
        }
        // Use placeholder as fallback
        if (element.placeholder) return element.placeholder;
      }

      // For images, use alt text
      if (element.tagName === 'IMG') {
        return element.alt || '';
      }

      // For buttons and links, use text content
      if (['BUTTON', 'A'].includes(element.tagName)) {
        return element.textContent?.trim() || '';
      }

      // Title attribute as fallback
      const title = element.getAttribute('title');
      if (title) return title;

      // For headings, use text content
      if (/^H[1-6]$/.test(element.tagName)) {
        return element.textContent?.trim() || '';
      }

      return '';
    }

    // Get element states
    function getStates(element) {
      const states = [];

      if (element.disabled || element.hasAttribute('aria-disabled')) {
        states.push('disabled');
      }
      if (element.checked || element.getAttribute('aria-checked') === 'true') {
        states.push('checked');
      }
      if (element.getAttribute('aria-expanded') === 'true') {
        states.push('expanded');
      } else if (element.getAttribute('aria-expanded') === 'false') {
        states.push('collapsed');
      }
      if (element.getAttribute('aria-pressed') === 'true') {
        states.push('pressed');
      }
      if (element.getAttribute('aria-selected') === 'true') {
        states.push('selected');
      }
      if (element.getAttribute('aria-hidden') === 'true') {
        states.push('hidden');
      }
      if (element.required || element.getAttribute('aria-required') === 'true') {
        states.push('required');
      }
      if (element.readOnly || element.getAttribute('aria-readonly') === 'true') {
        states.push('readonly');
      }
      if (element.getAttribute('aria-busy') === 'true') {
        states.push('busy');
      }
      if (element.getAttribute('aria-invalid') === 'true') {
        states.push('invalid');
      }

      // Check visibility
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 &&
                       style.display !== 'none' &&
                       style.visibility !== 'hidden' &&
                       style.opacity !== '0';
      if (!isVisible) {
        states.push('invisible');
      }

      // Check focus
      if (document.activeElement === element) {
        states.push('focused');
      }

      return states;
    }

    // Get ARIA properties
    function getProperties(element) {
      const properties = {};

      // Collect relevant ARIA properties
      const ariaAttrs = [
        'aria-describedby', 'aria-details', 'aria-errormessage',
        'aria-flowto', 'aria-haspopup', 'aria-keyshortcuts',
        'aria-live', 'aria-owns', 'aria-relevant', 'aria-roledescription',
        'aria-atomic', 'aria-level', 'aria-valuemin', 'aria-valuemax',
        'aria-valuenow', 'aria-valuetext', 'aria-orientation',
        'aria-placeholder', 'aria-autocomplete', 'aria-multiline',
        'aria-multiselectable', 'aria-sort', 'aria-colcount',
        'aria-colindex', 'aria-colspan', 'aria-rowcount',
        'aria-rowindex', 'aria-rowspan', 'aria-posinset', 'aria-setsize'
      ];

      ariaAttrs.forEach(attr => {
        const value = element.getAttribute(attr);
        if (value !== null) {
          const propName = attr.replace('aria-', '');
          properties[propName] = value;
        }
      });

      // Add heading level
      if (/^H[1-6]$/.test(element.tagName)) {
        properties['level'] = parseInt(element.tagName.charAt(1));
      }

      // Add input type
      if (element.tagName === 'INPUT') {
        properties['inputType'] = element.type || 'text';
      }

      return properties;
    }

    // Generate best selector for element
    function generateSelector(element) {
      if (element.id) {
        return '#' + element.id;
      }
      if (element.getAttribute('data-testid')) {
        return '[data-testid="' + element.getAttribute('data-testid') + '"]';
      }
      if (element.name && ['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
        return '[name="' + element.name + '"]';
      }
      if (element.className) {
        const classes = element.className.split(' ').filter(c => c.trim()).slice(0, 2);
        if (classes.length > 0) {
          return element.tagName.toLowerCase() + '.' + classes.join('.');
        }
      }
      return element.tagName.toLowerCase();
    }

    // Build accessibility tree recursively
    function buildTree(element, depth = 0) {
      if (depth > maxDepth) return null;

      const role = getRole(element);

      // Check role filters
      if (includeRoles && !includeRoles.includes(role)) {
        // Still process children
        const children = [];
        Array.from(element.children).forEach(child => {
          const childNode = buildTree(child, depth);
          if (childNode) children.push(childNode);
        });
        if (children.length === 1) return children[0];
        if (children.length > 1) {
          return {
            role: 'group',
            name: '',
            states: [],
            properties: {},
            children
          };
        }
        return null;
      }

      if (excludeRoles && excludeRoles.includes(role)) {
        return null;
      }

      // Check visibility
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 &&
                       style.display !== 'none' &&
                       style.visibility !== 'hidden';

      if (!includeHidden && !isVisible) {
        return null;
      }

      const name = getAccessibleName(element);
      const states = getStates(element);
      const properties = getProperties(element);

      const node = {
        role,
        name,
        states,
        properties,
        selector: generateSelector(element)
      };

      // Add value for inputs
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
        if (element.type !== 'password') {
          node.value = element.value || undefined;
        }
      }

      // Add description
      const describedBy = element.getAttribute('aria-describedby');
      if (describedBy) {
        const descElement = document.getElementById(describedBy);
        if (descElement) {
          node.description = descElement.textContent?.trim();
        }
      }

      // Add bounding box
      if (isVisible) {
        node.boundingBox = {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }

      // Add heading level
      if (/^H[1-6]$/.test(element.tagName)) {
        node.level = parseInt(element.tagName.charAt(1));
      }

      // Process children
      const children = [];
      Array.from(element.children).forEach(child => {
        const childNode = buildTree(child, depth + 1);
        if (childNode) children.push(childNode);
      });

      if (children.length > 0) {
        node.children = children;
      }

      return node;
    }

    // Build summary statistics
    function buildSummary(tree) {
      const roleDistribution = {};
      const landmarks = [];
      const headingStructure = [];
      let totalNodes = 0;
      let interactiveElements = 0;
      const warnings = [];

      const landmarkRoles = ['banner', 'complementary', 'contentinfo', 'form', 'main', 'navigation', 'region', 'search'];
      const interactiveRoles = ['button', 'checkbox', 'combobox', 'link', 'listbox', 'menuitem', 'option', 'radio', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'textbox', 'treeitem'];

      function traverse(node) {
        if (!node) return;

        totalNodes++;

        // Count roles
        roleDistribution[node.role] = (roleDistribution[node.role] || 0) + 1;

        // Track landmarks
        if (landmarkRoles.includes(node.role)) {
          landmarks.push(node.role + (node.name ? ': ' + node.name : ''));
        }

        // Track heading structure
        if (node.role === 'heading' && node.level) {
          headingStructure.push({ level: node.level, text: node.name || '' });
        }

        // Count interactive elements
        if (interactiveRoles.includes(node.role)) {
          interactiveElements++;
        }

        // Process children
        if (node.children) {
          node.children.forEach(traverse);
        }
      }

      traverse(tree);

      // Generate warnings
      if (!landmarks.includes('main') && !landmarks.some(l => l.startsWith('main'))) {
        warnings.push('No main landmark found - consider adding <main> element');
      }

      if (headingStructure.length > 0) {
        const firstHeading = headingStructure[0];
        if (firstHeading.level !== 1) {
          warnings.push('First heading is not h1 - consider starting with an h1');
        }

        // Check for skipped heading levels
        let prevLevel = 0;
        headingStructure.forEach((h, i) => {
          if (i > 0 && h.level > prevLevel + 1) {
            warnings.push('Skipped heading level: h' + prevLevel + ' to h' + h.level);
          }
          prevLevel = h.level;
        });
      }

      if (interactiveElements === 0) {
        warnings.push('No interactive elements found on the page');
      }

      return {
        totalNodes,
        roleDistribution,
        landmarks,
        headingStructure,
        interactiveElements,
        warnings
      };
    }

    // Get root element
    const rootElement = rootSelector ? document.querySelector(rootSelector) : document.body;

    if (!rootElement) {
      return {
        error: 'Root element not found' + (rootSelector ? ': ' + rootSelector : ''),
        tree: null,
        summary: null,
        pageInfo: null
      };
    }

    // Build the tree
    const tree = buildTree(rootElement);
    const summary = buildSummary(tree);

    // Get page info
    const pageInfo = {
      title: document.title,
      url: window.location.href,
      language: document.documentElement.lang || 'unknown'
    };

    return { tree, summary, pageInfo };
  });

  console.log('ACCESSIBILITY_SNAPSHOT_RESULT:', JSON.stringify(result));
});`;
  }

  /**
   * Execute accessibility capture in TestCafe
   */
  private async executeAccessibilityCapture(
    tempFile: string,
    options: AccessibilitySnapshotOptions
  ): Promise<Omit<AccessibilitySnapshotResult, 'captureTime'>> {
    const runner = this.testCafeInstance.createRunner();
    runner.src(tempFile);
    runner.browsers([options.browser || 'chrome:headless']);

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
    const resultMatch = capturedOutput.match(/ACCESSIBILITY_SNAPSHOT_RESULT: (.+)/);
    if (resultMatch) {
      try {
        const parsed = JSON.parse(resultMatch[1]);
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        return {
          tree: parsed.tree,
          summary: parsed.summary,
          pageInfo: parsed.pageInfo
        };
      } catch (error) {
        throw new Error(`Failed to parse accessibility snapshot: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error('No accessibility snapshot result captured');
  }

  /**
   * Generate accessibility snapshot code for manual use
   */
  generateAccessibilitySnapshotCode(options: Partial<AccessibilitySnapshotOptions>): string {
    const validatedOptions = AccessibilitySnapshotOptionsSchema.parse({
      url: options.url || 'about:blank',
      ...options
    });
    return this.generateAccessibilityTreeCode(validatedOptions);
  }

  /**
   * Create temporary test file
   */
  private async createTempTestFile(testCode: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testcafe-a11y-'));
    const tempFile = path.join(tempDir, 'accessibility-test.js');

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
