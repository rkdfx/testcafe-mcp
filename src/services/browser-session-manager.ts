/**
 * Browser Session Manager
 *
 * Singleton service that manages ONE persistent browser session across all MCP
 * tool calls for the TestCafe MCP server.  Implements the "snapshot -> ref -> act"
 * pattern (similar to Playwright MCP).
 *
 * Key design points:
 * - Singleton via `BrowserSessionManager.getInstance()`
 * - Lazy browser launch on first tool call
 * - Ref map rebuilt on each `snapshot()` call (refs are ephemeral per snapshot)
 * - Session auto-closes after 5 minutes of inactivity
 *
 * The persistent session works by running a long-lived TestCafe "test" that
 * exposes its test controller (`t`) through a global promise.  All browser
 * actions are performed through that controller until `close()` is called or
 * the inactivity timeout fires.
 */

import * as os from 'os';
import * as path from 'path';
import { writeFile, unlink } from 'fs/promises';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape returned by the in-browser DOM traversal function. */
interface SnapshotNode {
  role: string;
  name?: string;
  selector?: string;
  interactive?: boolean;
  level?: number;
  value?: string;
  states?: string[];
  children?: SnapshotNode[];
}

interface SnapshotResult {
  tree: SnapshotNode | null;
  pageInfo: { title: string; url: string };
}

// ---------------------------------------------------------------------------
// Client-side snapshot code (runs in the browser via ClientFunction)
//
// This is a plain JavaScript string so that TypeScript does not attempt to
// resolve browser-only globals (document, window, CSS, etc.).
// ---------------------------------------------------------------------------

const SNAPSHOT_CLIENT_CODE = `
(function () {
  var implicitRoleMap = {
    'a': function (el) { return el.href ? 'link' : null; },
    'article': function () { return 'article'; },
    'aside': function () { return 'complementary'; },
    'button': function () { return 'button'; },
    'details': function () { return 'group'; },
    'dialog': function () { return 'dialog'; },
    'footer': function (el) {
      var p = el.parentElement;
      if (p && ['article','aside','main','nav','section'].indexOf(p.tagName.toLowerCase()) !== -1) return null;
      return 'contentinfo';
    },
    'form': function () { return 'form'; },
    'h1': function () { return 'heading'; },
    'h2': function () { return 'heading'; },
    'h3': function () { return 'heading'; },
    'h4': function () { return 'heading'; },
    'h5': function () { return 'heading'; },
    'h6': function () { return 'heading'; },
    'header': function (el) {
      var p = el.parentElement;
      if (p && ['article','aside','main','nav','section'].indexOf(p.tagName.toLowerCase()) !== -1) return null;
      return 'banner';
    },
    'hr': function () { return 'separator'; },
    'img': function (el) { return el.alt ? 'img' : 'presentation'; },
    'input': function (el) {
      var type = (el.type || 'text').toLowerCase();
      var m = { 'button':'button','checkbox':'checkbox','email':'textbox','image':'button','number':'spinbutton','radio':'radio','range':'slider','reset':'button','search':'searchbox','submit':'button','tel':'textbox','text':'textbox','url':'textbox','password':'textbox' };
      return m[type] || 'textbox';
    },
    'li': function () { return 'listitem'; },
    'main': function () { return 'main'; },
    'nav': function () { return 'navigation'; },
    'ol': function () { return 'list'; },
    'option': function () { return 'option'; },
    'select': function (el) { return el.multiple ? 'listbox' : 'combobox'; },
    'summary': function () { return 'button'; },
    'table': function () { return 'table'; },
    'tbody': function () { return 'rowgroup'; },
    'td': function () { return 'cell'; },
    'textarea': function () { return 'textbox'; },
    'tfoot': function () { return 'rowgroup'; },
    'th': function () { return 'columnheader'; },
    'thead': function () { return 'rowgroup'; },
    'tr': function () { return 'row'; },
    'ul': function () { return 'list'; }
  };

  var interactiveRoles = ['button','checkbox','combobox','link','listbox','menuitem','option','radio','searchbox','slider','spinbutton','switch','tab','textbox','treeitem'];
  function isInteractive(role) {
    return interactiveRoles.indexOf(role) !== -1;
  }

  function getRole(el) {
    var explicit = el.getAttribute('role');
    if (explicit) return explicit;
    var tag = el.tagName.toLowerCase();
    var getter = implicitRoleMap[tag];
    if (getter) { var r = getter(el); if (r) return r; }
    return 'generic';
  }

  function getName(el) {
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    var labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      var labelEl = document.getElementById(labelledBy);
      if (labelEl) return (labelEl.textContent || '').trim();
    }
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      if (el.id) {
        var label = document.querySelector('label[for="' + el.id + '"]');
        if (label) return (label.textContent || '').trim();
      }
      var parentLabel = el.closest('label');
      if (parentLabel) {
        var parts = [];
        for (var i = 0; i < parentLabel.childNodes.length; i++) {
          var n = parentLabel.childNodes[i];
          if (n.nodeType === 3 && n.textContent) {
            var t = n.textContent.trim();
            if (t) parts.push(t);
          }
        }
        if (parts.length > 0) return parts.join(' ');
      }
      if (el.placeholder) return el.placeholder;
    }
    if (el.tagName === 'IMG') return el.alt || '';
    if (el.tagName === 'BUTTON' || el.tagName === 'A') return (el.textContent || '').trim();
    if (/^H[1-6]$/.test(el.tagName)) return (el.textContent || '').trim();
    return el.getAttribute('title') || '';
  }

  function getSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    var testId = el.getAttribute('data-testid');
    if (testId) return '[data-testid="' + testId + '"]';
    if (el.name && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
      return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
    }
    var tag = el.tagName.toLowerCase();
    var parent = el.parentElement;
    if (parent) {
      var siblings = [];
      for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i].tagName === el.tagName) siblings.push(parent.children[i]);
      }
      var parentSel = getSelector(parent);
      if (siblings.length === 1) {
        return parentSel + ' > ' + tag;
      } else {
        var idx = siblings.indexOf(el) + 1;
        return parentSel + ' > ' + tag + ':nth-of-type(' + idx + ')';
      }
    }
    return tag;
  }

  function isVisible(el) {
    var style = window.getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function buildTree(el, depth) {
    if (depth > 20) return null;
    var role = getRole(el);
    var vis = isVisible(el);
    if (!vis && el !== document.body) return null;

    var name = getName(el);
    var inter = isInteractive(role);
    var node = { role: role, name: name || undefined };

    if (inter || role === 'heading' || role === 'img') {
      node.selector = getSelector(el);
      node.interactive = true;
    }

    if (/^H[1-6]$/.test(el.tagName)) node.level = parseInt(el.tagName.charAt(1), 10);
    if ((el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') && el.type !== 'password') {
      node.value = el.value || undefined;
    }

    var states = [];
    if (el.disabled) states.push('disabled');
    if (el.checked) states.push('checked');
    if (el.getAttribute('aria-expanded') === 'true') states.push('expanded');
    if (el.getAttribute('aria-expanded') === 'false') states.push('collapsed');
    if (el.required) states.push('required');
    if (document.activeElement === el) states.push('focused');
    if (states.length > 0) node.states = states;

    var children = [];
    for (var i = 0; i < el.children.length; i++) {
      var child = buildTree(el.children[i], depth + 1);
      if (child) children.push(child);
    }
    if (children.length > 0) node.children = children;

    if (role === 'generic' && !name && children.length === 1 && !inter) return children[0];
    if (role === 'generic' && !name && children.length === 0 && !inter) return null;

    return node;
  }

  var tree = buildTree(document.body, 0);
  return { tree: tree, pageInfo: { title: document.title, url: window.location.href } };
})()
`.trim();

// ---------------------------------------------------------------------------
// BrowserSessionManager
// ---------------------------------------------------------------------------

export class BrowserSessionManager {
  // -- Singleton -------------------------------------------------------------
  private static instance: BrowserSessionManager;

  static getInstance(): BrowserSessionManager {
    if (!BrowserSessionManager.instance) {
      BrowserSessionManager.instance = new BrowserSessionManager();
    }
    return BrowserSessionManager.instance;
  }

  // -- State -----------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private testCafeModule: any = null; // cached default export from 'testcafe'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private testCafe: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private runner: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private testController: any = null;
  private currentUrl: string = 'about:blank';
  private elementRefMap: Map<string, string> = new Map(); // ref -> CSS selector
  private refCounter: number = 0;
  private lastActivity: number = Date.now();
  private sessionTimeout: number = 300_000; // 5 min
  private cleanupTimer: NodeJS.Timeout | null = null;
  private sessionReady: boolean = false;
  private tempTestFile: string = '';

  /** Private constructor -- use `getInstance()` */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  // -- Public API ------------------------------------------------------------

  /**
   * Ensure a persistent browser session is running.  If one already exists and
   * is healthy, this is a no-op (just resets the inactivity timer).
   *
   * @param browser - TestCafe browser string.  Defaults to headless Chromium
   *   with sandbox-safe flags.
   */
  async ensureSession(browser?: string): Promise<void> {
    if (this.sessionReady && this.testController) {
      this.touchActivity();
      return;
    }

    const browserString =
      browser ??
      'chromium:headless --no-sandbox --disable-dev-shm-usage --disable-gpu';

    // 1. Lazy-import testcafe (default export has createTestCafe, Selector, ClientFunction)
    this.testCafeModule = (await import('testcafe')).default;
    const createTestCafe = this.testCafeModule;

    // 2. Create TestCafe instance with random ports
    this.testCafe = await createTestCafe('localhost', 0, 0);

    // 3. Write a temporary test file that will hand us the test controller
    const testCode = [
      "import { Selector } from 'testcafe';",
      "fixture('Persistent Session').page('about:blank');",
      "test('Session', async t => {",
      '  global.__tcResolve(t);',
      '  await new Promise(resolve => { global.__tcDone = resolve; });',
      '});',
    ].join('\n');

    this.tempTestFile = path.join(
      os.tmpdir(),
      `testcafe-session-${Date.now()}.js`,
    );
    await writeFile(this.tempTestFile, testCode, 'utf-8');

    // 4. Set up the global resolver so the test can pass us `t`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controllerPromise = new Promise<any>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).__tcResolve = resolve;
    });

    // 5. Start the runner (non-blocking -- the test stays alive)
    this.runner = this.testCafe.createRunner();
    const runPromise = this.runner
      .src(this.tempTestFile)
      .browsers(browserString)
      .screenshots({ path: os.tmpdir(), takeOnFails: false, thumbnails: false })
      .run({ disableNativeAutomation: true });

    // Keep the run promise around so we can detect unexpected exits, but we
    // do not await it here -- the test is intentionally long-lived.
    runPromise.catch((err: Error) => {
      console.error('[BrowserSessionManager] Runner exited unexpectedly:', err.message);
      this.resetState();
    });

    // 6. Wait for the test controller with a 30 s timeout
    const CONTROLLER_TIMEOUT_MS = 30_000;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Timed out waiting for TestCafe test controller')),
        CONTROLLER_TIMEOUT_MS,
      ),
    );

    try {
      this.testController = await Promise.race([controllerPromise, timeout]);
    } catch (err) {
      // Clean up on failure
      await this.close();
      throw err;
    }

    this.sessionReady = true;
    this.touchActivity();
    this.startCleanupTimer();

    console.error('[BrowserSessionManager] Session ready');
  }

  /**
   * Navigate the browser to the given URL and wait for the page to finish
   * loading (`document.readyState === 'complete'`).
   */
  async navigate(url: string): Promise<void> {
    await this.ensureSession();
    await this.testController.navigateTo(url);

    // Wait for page to become ready using ClientFunction (runs in browser).
    // We use `new Function` to avoid TypeScript resolving browser-only globals.
    try {
      const { ClientFunction } = this.testCafeModule;
      const getReadyState = ClientFunction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new Function('return document.readyState') as () => any,
      ).with({ boundTestRun: this.testController });
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        const state = await getReadyState();
        if (state === 'complete') break;
        await new Promise<void>((resolve) => setTimeout(resolve, 200));
      }
    } catch {
      // Best-effort -- some pages never reach 'complete'
    }

    this.currentUrl = url;
    this.touchActivity();
  }

  /**
   * Take an accessibility snapshot of the current page.
   *
   * Clears the previous ref map, traverses the DOM via `ClientFunction`,
   * assigns ref IDs (`e1`, `e2`, ...) to interactive elements, headings, and
   * images, and returns a formatted text tree.
   */
  async snapshot(): Promise<string> {
    await this.ensureSession();

    // Reset refs
    this.elementRefMap.clear();
    this.refCounter = 0;

    const result: SnapshotResult = await this.buildSnapshotTree();

    if (!result || !result.tree) {
      this.touchActivity();
      return `[empty page]\nPage: ${result?.pageInfo?.title ?? ''} (${result?.pageInfo?.url ?? this.currentUrl})`;
    }

    // Format the tree into text and populate elementRefMap
    const lines: string[] = [];
    lines.push(`Page: ${result.pageInfo.title} (${result.pageInfo.url})`);
    lines.push('');
    this.formatNode(result.tree, 0, lines);

    this.touchActivity();
    return lines.join('\n');
  }

  /**
   * Click on an element identified by its snapshot ref.
   */
  async click(
    ref: string,
    options?: { button?: string; doubleClick?: boolean },
  ): Promise<void> {
    await this.ensureSession();
    const css = this.resolveRef(ref);
    const { Selector } = this.testCafeModule;
    const el = Selector(css);

    if (options?.doubleClick) {
      await this.testController.doubleClick(el);
    } else if (options?.button === 'right') {
      await this.testController.rightClick(el);
    } else {
      await this.testController.click(el);
    }

    this.touchActivity();
  }

  /**
   * Type text into an element identified by its snapshot ref.
   *
   * By default the existing text is replaced.  Set `options.slowly` to type
   * one character at a time (speed 0.1).  Set `options.submit` to press Enter
   * after typing.
   */
  async type(
    ref: string,
    text: string,
    options?: { submit?: boolean; slowly?: boolean },
  ): Promise<void> {
    await this.ensureSession();
    const css = this.resolveRef(ref);
    const { Selector } = this.testCafeModule;
    const el = Selector(css);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeOptions: Record<string, any> = { replace: true };
    if (options?.slowly) {
      typeOptions.speed = 0.1;
    }

    await this.testController.typeText(el, text, typeOptions);

    if (options?.submit) {
      await this.testController.pressKey('enter');
    }

    this.touchActivity();
  }

  /**
   * Press a keyboard key (e.g. 'enter', 'tab', 'escape', 'backspace').
   */
  async pressKey(key: string): Promise<void> {
    await this.ensureSession();
    await this.testController.pressKey(key);
    this.touchActivity();
  }

  /**
   * Select option(s) in a `<select>` element identified by its snapshot ref.
   *
   * For each value the method clicks the matching `<option>` inside the
   * select element.
   */
  async selectOption(ref: string, values: string[]): Promise<void> {
    await this.ensureSession();
    const css = this.resolveRef(ref);
    const { Selector } = this.testCafeModule;

    for (const value of values) {
      const option = Selector(css).find('option').withText(value);
      await this.testController.click(option);
    }

    this.touchActivity();
  }

  /**
   * Evaluate arbitrary JavaScript in the browser context.
   *
   * If `ref` is provided the element is resolved to a CSS selector and the
   * code can reference it via `document.querySelector(selector)`.
   *
   * @returns The serialisable return value of the evaluated code.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async evaluate(code: string, ref?: string): Promise<any> {
    await this.ensureSession();

    const { ClientFunction } = this.testCafeModule;

    if (ref) {
      const css = this.resolveRef(ref);
      // Build a function that receives the selector string, queries the element,
      // and runs the user code with it.
      const wrappedCode =
        '(function() {' +
        '  var el = document.querySelector(' + JSON.stringify(css) + ');' +
        '  var userFn = new Function("element", ' + JSON.stringify(code) + ');' +
        '  return userFn(el);' +
        '})()';

      const fn = ClientFunction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new Function('return ' + wrappedCode) as () => any,
      ).with({ boundTestRun: this.testController });
      const result = await fn();
      this.touchActivity();
      return result;
    }

    // No element context -- evaluate as a standalone expression / IIFE.
    const fn = ClientFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new Function('return (' + code + ')') as () => any,
    ).with({ boundTestRun: this.testController });
    const result = await fn();
    this.touchActivity();
    return result;
  }

  /**
   * Take a screenshot of the current page.
   *
   * @returns The absolute file path to the saved screenshot.
   */
  async screenshot(
    options?: { filename?: string; fullPage?: boolean },
  ): Promise<string> {
    await this.ensureSession();

    const filename = options?.filename ?? `screenshot-${Date.now()}.png`;
    // TestCafe resolves the path relative to the screenshots base directory
    // (configured as os.tmpdir() on the runner), so pass just the filename.
    const expectedPath = path.join(os.tmpdir(), filename);

    try {
      if (options?.fullPage) {
        await this.testController.takeScreenshot({
          path: filename,
          fullPage: true,
        });
      } else {
        await this.testController.takeScreenshot(filename);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      throw new Error(`Screenshot failed: ${msg}`);
    }

    this.touchActivity();
    return expectedPath;
  }

  /**
   * Gracefully close the persistent browser session and release all resources.
   */
  async close(): Promise<void> {
    if (!this.sessionReady && !this.testCafe) {
      return;
    }

    console.error('[BrowserSessionManager] Closing session');

    // 1. Signal the long-running test to finish
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doneFn = (global as any).__tcDone;
    if (typeof doneFn === 'function') {
      doneFn();
    }

    // Brief wait for the runner to wind down
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    // 2. Close the TestCafe instance
    try {
      await this.testCafe?.close();
    } catch (err) {
      console.error(
        '[BrowserSessionManager] Error closing TestCafe:',
        err instanceof Error ? err.message : String(err),
      );
    }

    // 3. Remove the temporary test file
    try {
      if (this.tempTestFile) {
        await unlink(this.tempTestFile);
      }
    } catch {
      // Ignore -- file may already be gone
    }

    // 4. Reset all state
    this.resetState();
  }

  // -- Ref resolution --------------------------------------------------------

  /**
   * Resolve a snapshot ref (e.g. "e5") to its CSS selector.
   *
   * @throws If the ref is not present in the current ref map.
   */
  resolveRef(ref: string): string {
    const selector = this.elementRefMap.get(ref);
    if (!selector) {
      throw new Error(
        `Element ref "${ref}" not found. Take a new snapshot to get current refs.`,
      );
    }
    return selector;
  }

  /** Returns `true` if the persistent browser session is alive. */
  isSessionActive(): boolean {
    return this.sessionReady && this.testController !== null;
  }

  /** Returns the URL of the page currently loaded in the browser. */
  getCurrentUrl(): string {
    return this.currentUrl;
  }

  // -- Private helpers -------------------------------------------------------

  /** Update `lastActivity` and restart the inactivity cleanup timer. */
  private touchActivity(): void {
    this.lastActivity = Date.now();
    this.startCleanupTimer();
  }

  /** Start (or restart) the periodic inactivity check. */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.cleanupTimer = setInterval(() => {
      if (Date.now() - this.lastActivity > this.sessionTimeout) {
        console.error(
          '[BrowserSessionManager] Session timed out due to inactivity',
        );
        this.close().catch((err) => {
          console.error(
            '[BrowserSessionManager] Error during timeout cleanup:',
            err instanceof Error ? err.message : String(err),
          );
        });
      }
    }, 30_000); // check every 30 s

    // Ensure the timer does not prevent Node from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /** Reset internal state to the "no session" baseline. */
  private resetState(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).__tcResolve;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).__tcDone;

    this.testCafeModule = null;
    this.testCafe = null;
    this.runner = null;
    this.testController = null;
    this.sessionReady = false;
    this.tempTestFile = '';
    this.elementRefMap.clear();
    this.refCounter = 0;
    this.currentUrl = 'about:blank';
  }

  // -- Snapshot helpers ------------------------------------------------------

  /**
   * Run the client-side DOM traversal via `ClientFunction` and return the
   * accessibility snapshot tree.
   *
   * The traversal code lives in `SNAPSHOT_CLIENT_CODE` (a plain JS string)
   * so that TypeScript does not attempt to resolve browser-only globals.
   */
  private async buildSnapshotTree(): Promise<SnapshotResult> {
    const { ClientFunction } = this.testCafeModule;

    // Build a ClientFunction from the pre-defined browser-side JS string.
    // `new Function(...)` wraps the IIFE so that ClientFunction receives a
    // zero-argument function that returns the snapshot result.
    const snapshotFn = ClientFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new Function('return ' + SNAPSHOT_CLIENT_CODE) as () => any,
    ).with({ boundTestRun: this.testController });

    const result: SnapshotResult = await snapshotFn();
    return result;
  }

  /**
   * Recursively format a `SnapshotNode` tree into indented text lines and
   * assign ref IDs to interactive elements, headings, and images.
   */
  private formatNode(
    node: SnapshotNode,
    indent: number,
    lines: string[],
  ): void {
    const prefix = '  '.repeat(indent) + '- ';
    let line = prefix + node.role;

    // Accessible name
    if (node.name) {
      line += ` "${node.name}"`;
    }

    // Heading level
    if (node.level !== undefined) {
      line += ` [level=${node.level}]`;
    }

    // Value (textbox, combobox, etc.)
    if (node.value !== undefined) {
      line += ` [value="${node.value}"]`;
    }

    // States
    if (node.states && node.states.length > 0) {
      line += ` [${node.states.join(', ')}]`;
    }

    // Assign a ref if the element is interactive / heading / image
    if (node.interactive && node.selector) {
      this.refCounter += 1;
      const ref = `e${this.refCounter}`;
      this.elementRefMap.set(ref, node.selector);
      line += ` [ref=${ref}]`;
    }

    lines.push(line);

    // Recurse into children
    if (node.children) {
      for (const child of node.children) {
        this.formatNode(child, indent + 1, lines);
      }
    }
  }
}
