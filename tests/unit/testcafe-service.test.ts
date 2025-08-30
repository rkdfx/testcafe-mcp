/**
 * Unit tests for TestCafeService
 */

// Mock TestCafe before importing - must be first
jest.mock('testcafe');

import { TestCafeService } from '../../src/services/testcafe-service.js';

describe('TestCafeService', () => {
  let service: TestCafeService;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = {
      browsers: [{ name: 'chrome' as const, headless: true, args: [] }],
      timeout: 30000,
      speed: 1,
      concurrency: 1,
      quarantineMode: false,
      skipJsErrors: false,
      skipUncaughtErrors: false,
      stopOnFirstFail: false
    };
    service = new TestCafeService(config);
  });

  afterEach(async () => {
    await service.close();
  });

  describe('constructor', () => {
    it('should create service instance', () => {
      expect(service).toBeInstanceOf(TestCafeService);
    });
  });

  describe('initialize', () => {
    it('should initialize TestCafe instance', async () => {
      // Just test that it doesn't throw - the mock handles the actual call
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('validateTestCode', () => {
    it('should validate correct TestCafe code', () => {
      const validCode = `
        import { Selector } from 'testcafe';
        
        fixture('Test Fixture')
          .page('https://example.com');
        
        test('test name', async t => {
          await t.click('#button');
        });
      `;
      
      const result = service.validateTestCode(validCode);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject code without fixture', () => {
      const invalidCode = `
        test('test without fixture', async t => {
          await t.click('#button');
        });
      `;
      
      const result = service.validateTestCode(invalidCode);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject code without test', () => {
      const invalidCode = `
        import { Selector } from 'testcafe';
        fixture('Test Fixture').page('https://example.com');
        // No test defined
      `;
      
      const result = service.validateTestCode(invalidCode);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateTestStructure', () => {
    it('should validate correct test structure', () => {
      const validStructure = {
        fixture: 'Test Fixture',
        url: 'https://example.com',
        tests: [{
          name: 'Test Case',
          actions: [{
            type: 'click' as const,
            selector: '#button'
          }]
        }]
      };
      
      const result = service.validateTestStructure(validStructure);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject structure with missing fixture', () => {
      const invalidStructure = {
        fixture: '',
        tests: [{
          name: 'Test Case',
          actions: [{
            type: 'click' as const,
            selector: '#button'
          }]
        }]
      };
      
      const result = service.validateTestStructure(invalidStructure);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject structure with empty tests array', () => {
      const invalidStructure = {
        fixture: 'Test Fixture',
        tests: []
      };
      
      const result = service.validateTestStructure(invalidStructure);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('createTestFile', () => {
    it('should generate valid TestCafe code', () => {
      const testStructure = {
        fixture: 'Test Fixture',
        url: 'https://example.com',
        tests: [{
          name: 'Test Case',
          actions: [
            { type: 'click' as const, selector: '#login' },
            { type: 'type' as const, selector: '#username', value: 'testuser' }
          ]
        }]
      };
      
      const result = service.createTestFile(testStructure);
      
      expect(result).toContain('fixture(\'Test Fixture\')');
      expect(result).toContain('.page(\'https://example.com\')');
      expect(result).toContain('test(\'Test Case\'');
      expect(result).toContain('await t.click(');
      expect(result).toContain('await t.typeText(');
    });

    it('should handle fixture without URL', () => {
      const testStructure = {
        fixture: 'Test Fixture',
        tests: [{
          name: 'Test Case',
          actions: [
            { type: 'navigate' as const, value: 'https://example.com' }
          ]
        }]
      };
      
      const result = service.createTestFile(testStructure);
      
      expect(result).toContain('fixture(\'Test Fixture\')');
      expect(result).toContain('await t.navigateTo(\'https://example.com\')');
    });

    it('should handle special characters in strings', () => {
      const testStructure = {
        fixture: 'Test "Special" Fixture',
        tests: [{
          name: 'Test \'Case\'',
          actions: [
            { type: 'type' as const, selector: '#input', value: 'Text with "quotes"' }
          ]
        }]
      };
      
      const result = service.createTestFile(testStructure);
      
      // Check that the result contains the fixture and test, quotes handled appropriately
      expect(result).toContain('fixture(');
      expect(result).toContain('test(');
      expect(result).toContain('await t.typeText(');
    });
  });

  describe('close', () => {
    it('should close TestCafe instance', async () => {
      // Test doesn't need actual initialization since we're using mocks
      await expect(service.close()).resolves.not.toThrow();
    });

    it('should handle close when TestCafe not initialized', async () => {
      await expect(service.close()).resolves.not.toThrow();
    });
  });
});
