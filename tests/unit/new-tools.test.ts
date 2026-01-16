/**
 * Unit tests for new MCP tools:
 * - AccessibilitySnapshotTool
 * - TabManagementTool
 * - NetworkLogsTool
 */

// Mock testcafe before importing tools
jest.mock('testcafe', () => ({
  default: jest.fn().mockResolvedValue({
    createRunner: jest.fn().mockReturnValue({
      src: jest.fn().mockReturnThis(),
      browsers: jest.fn().mockReturnThis(),
      screenshots: jest.fn().mockReturnThis(),
      reporter: jest.fn().mockReturnThis(),
      run: jest.fn().mockResolvedValue(0)
    }),
    close: jest.fn().mockResolvedValue(undefined)
  }),
  RequestLogger: jest.fn().mockImplementation(() => ({
    requests: []
  })),
  Selector: jest.fn()
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn().mockResolvedValue('/tmp/testcafe-test-123'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  rmdir: jest.fn().mockResolvedValue(undefined)
}));

// Mock os
jest.mock('os', () => ({
  tmpdir: jest.fn().mockReturnValue('/tmp')
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/'))
}));

import { z } from 'zod';
import {
  AccessibilitySnapshotTool,
  TabManagementTool,
  NetworkLogsTool
} from '../../src/tools/index.js';

import {
  AccessibilitySnapshotOptionsSchema
} from '../../src/services/accessibility-service.js';

import {
  TabManagementOptionsSchema
} from '../../src/services/tab-management-service.js';

import {
  NetworkMonitoringOptionsSchema
} from '../../src/services/network-monitoring-service.js';

describe('AccessibilitySnapshotTool', () => {
  let tool: AccessibilitySnapshotTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new AccessibilitySnapshotTool();
  });

  describe('tool properties', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('get_accessibility_snapshot');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(0);
    });

    it('should have input schema', () => {
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('input schema validation', () => {
    it('should accept valid input with required url', () => {
      const input = {
        url: 'https://example.com'
      };
      const result = AccessibilitySnapshotOptionsSchema.parse(input);
      expect(result.url).toBe('https://example.com');
      expect(result.maxDepth).toBe(10); // default
      expect(result.includeHidden).toBe(false); // default
      expect(result.browser).toBe('chrome:headless'); // default
    });

    it('should accept full input with all options', () => {
      const input = {
        url: 'https://example.com',
        selector: '#main',
        includeHidden: true,
        maxDepth: 5,
        browser: 'firefox:headless',
        waitTime: 3000,
        includeRoles: ['button', 'link'],
        excludeRoles: ['generic']
      };
      const result = AccessibilitySnapshotOptionsSchema.parse(input);
      expect(result).toMatchObject(input);
    });

    it('should reject invalid url', () => {
      const input = {
        url: 'not-a-url'
      };
      expect(() => AccessibilitySnapshotOptionsSchema.parse(input)).toThrow();
    });

    it('should reject maxDepth out of range', () => {
      expect(() => AccessibilitySnapshotOptionsSchema.parse({
        url: 'https://example.com',
        maxDepth: 0
      })).toThrow();

      expect(() => AccessibilitySnapshotOptionsSchema.parse({
        url: 'https://example.com',
        maxDepth: 25
      })).toThrow();
    });
  });
});

describe('TabManagementTool', () => {
  let tool: TabManagementTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new TabManagementTool();
  });

  describe('tool properties', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('browser_tabs');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(0);
    });

    it('should have input schema', () => {
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('input schema validation', () => {
    it('should accept list operation', () => {
      const input = {
        operation: 'list' as const
      };
      const result = TabManagementOptionsSchema.parse(input);
      expect(result.operation).toBe('list');
      expect(result.browser).toBe('chrome:headless'); // default
      expect(result.waitForLoad).toBe(true); // default
    });

    it('should accept create operation with url', () => {
      const input = {
        operation: 'create' as const,
        url: 'https://example.com'
      };
      const result = TabManagementOptionsSchema.parse(input);
      expect(result.operation).toBe('create');
      expect(result.url).toBe('https://example.com');
    });

    it('should accept close operation with tabId', () => {
      const input = {
        operation: 'close' as const,
        tabId: 'tab_123'
      };
      const result = TabManagementOptionsSchema.parse(input);
      expect(result.operation).toBe('close');
      expect(result.tabId).toBe('tab_123');
    });

    it('should accept switch operation with tabId', () => {
      const input = {
        operation: 'switch' as const,
        tabId: 'main_window'
      };
      const result = TabManagementOptionsSchema.parse(input);
      expect(result.operation).toBe('switch');
      expect(result.tabId).toBe('main_window');
    });

    it('should reject invalid operation', () => {
      const input = {
        operation: 'invalid'
      };
      expect(() => TabManagementOptionsSchema.parse(input)).toThrow();
    });
  });
});

describe('NetworkLogsTool', () => {
  let tool: NetworkLogsTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new NetworkLogsTool();
  });

  describe('tool properties', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('get_network_logs');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(0);
    });

    it('should have input schema', () => {
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('input schema validation', () => {
    it('should accept valid input with required url', () => {
      const input = {
        url: 'https://example.com'
      };
      const result = NetworkMonitoringOptionsSchema.parse(input);
      expect(result.url).toBe('https://example.com');
      expect(result.waitTime).toBe(5000); // default
      expect(result.browser).toBe('chrome:headless'); // default
      expect(result.includeHeaders).toBe(true); // default
      expect(result.includeBody).toBe(false); // default
    });

    it('should accept full input with all options', () => {
      const input = {
        url: 'https://example.com',
        filter: {
          urlPattern: '/api/',
          methods: ['GET', 'POST'] as const,
          statusCodes: [200, 404],
          resourceTypes: ['xhr', 'fetch'] as const
        },
        waitTime: 10000,
        browser: 'firefox:headless',
        includeHeaders: true,
        includeBody: true,
        maxBodySize: 5000,
        maxLogs: 50
      };
      const result = NetworkMonitoringOptionsSchema.parse(input);
      expect(result.url).toBe('https://example.com');
      expect(result.filter?.urlPattern).toBe('/api/');
      expect(result.filter?.methods).toEqual(['GET', 'POST']);
    });

    it('should reject invalid url', () => {
      const input = {
        url: 'not-a-url'
      };
      expect(() => NetworkMonitoringOptionsSchema.parse(input)).toThrow();
    });

    it('should reject invalid method', () => {
      const input = {
        url: 'https://example.com',
        filter: {
          methods: ['INVALID']
        }
      };
      expect(() => NetworkMonitoringOptionsSchema.parse(input)).toThrow();
    });

    it('should reject waitTime out of range', () => {
      expect(() => NetworkMonitoringOptionsSchema.parse({
        url: 'https://example.com',
        waitTime: 50 // too low
      })).toThrow();

      expect(() => NetworkMonitoringOptionsSchema.parse({
        url: 'https://example.com',
        waitTime: 100000 // too high
      })).toThrow();
    });

    it('should reject maxLogs out of range', () => {
      expect(() => NetworkMonitoringOptionsSchema.parse({
        url: 'https://example.com',
        maxLogs: 0 // too low
      })).toThrow();

      expect(() => NetworkMonitoringOptionsSchema.parse({
        url: 'https://example.com',
        maxLogs: 2000 // too high
      })).toThrow();
    });
  });
});

describe('New Services', () => {
  describe('AccessibilityService', () => {
    it('should be exported from services index', async () => {
      const { AccessibilityService } = await import('../../src/services/index.js');
      expect(AccessibilityService).toBeDefined();
    });
  });

  describe('TabManagementService', () => {
    it('should be exported from services index', async () => {
      const { TabManagementService } = await import('../../src/services/index.js');
      expect(TabManagementService).toBeDefined();
    });
  });

  describe('NetworkMonitoringService', () => {
    it('should be exported from services index', async () => {
      const { NetworkMonitoringService } = await import('../../src/services/index.js');
      expect(NetworkMonitoringService).toBeDefined();
    });
  });
});
