/**
 * Basic integration tests for TestCafe MCP functionality
 */

// Mock TestCafe before importing
jest.mock('testcafe');

import { TestCafeService } from '../../src/services/testcafe-service.js';
import { CreateTestTool } from '../../src/tools/create-test-tool.js';
import { ValidateTestTool } from '../../src/tools/validate-test-tool.js';

const mockTestCafeConfig = {
  browsers: [{ name: 'chrome' as const, headless: true, args: [] }],
  timeout: 30000,
  speed: 1,
  concurrency: 1,
  quarantineMode: false,
  skipJsErrors: false,
  skipUncaughtErrors: false,
  stopOnFirstFail: false
};

describe('TestCafe MCP Integration', () => {
  let service: TestCafeService;
  let createTool: CreateTestTool;
  let validateTool: ValidateTestTool;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestCafeService(mockTestCafeConfig);
    createTool = new CreateTestTool(service);
    validateTool = new ValidateTestTool(service);
  });

  afterEach(async () => {
    await service.close();
  });

  describe('CreateTestTool', () => {
    it('should have correct name and description', () => {
      expect(createTool.name).toBe('create_test');
      expect(createTool.description).toContain('Create a TestCafe test');
    });

    it('should create test file successfully', async () => {
      // Mock file system operations
      const fs = require('fs/promises');
      jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      const args = {
        testStructure: {
          fixture: 'Test Fixture',
          url: 'https://example.com',
          tests: [{
            name: 'Simple test',
            actions: [
              { type: 'click' as const, selector: '#button' }
            ]
          }]
        },
        outputPath: './test.js',
        validate: true
      };

      const result = await createTool.execute(args);
      
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
      expect((result.content[0] as { type: 'text'; text: string }).text).toContain('Successfully created');
    });
  });

  describe('ValidateTestTool', () => {
    it('should have correct name and description', () => {
      expect(validateTool.name).toBe('validate_test');
      expect(validateTool.description).toContain('Validate TestCafe test');
    });

    it('should validate test code successfully', async () => {
      const args = {
        source: {
          type: 'code' as const,
          content: `
            import { Selector } from 'testcafe';

            fixture('Test Fixture')
              .page('https://example.com');

            test('Simple test', async t => {
              await t.click('#button');
            });
          `
        },
        validationLevel: 'basic' as const,
        includeWarnings: true,
        includeSuggestions: false
      };

      const result = await validateTool.execute(args);

      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
      expect((result.content[0] as { type: 'text'; text: string }).text).toContain('VALID');
    });

    it('should detect invalid test code', async () => {
      const args = {
        source: {
          type: 'code' as const,
          content: `
            // Invalid code - no fixture or test
            console.log('This is not a TestCafe test');
          `
        },
        validationLevel: 'basic' as const,
        includeWarnings: true,
        includeSuggestions: false
      };

      const result = await validateTool.execute(args);

      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
      expect((result.content[0] as { type: 'text'; text: string }).text).toContain('INVALID');
    });
  });

  describe('Service and Tools Integration', () => {
    it('should create and validate test in sequence', async () => {
      // Mock file system
      const fs = require('fs/promises');
      jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      // Step 1: Create test
      const createArgs = {
        testStructure: {
          fixture: 'Integration Test',
          url: 'https://example.com',
          tests: [{
            name: 'Test workflow',
            actions: [
              { type: 'click' as const, selector: '#login' },
              { type: 'type' as const, selector: '#username', value: 'testuser' }
            ]
          }]
        },
        outputPath: './integration-test.js',
        validate: false
      };

      const createResult = await createTool.execute(createArgs);
      expect((createResult.content[0] as { type: 'text'; text: string }).text).toContain('Successfully created');

      // Step 2: Validate the generated structure
      const validateArgs = {
        source: {
          type: 'structure' as const,
          testStructure: createArgs.testStructure
        },
        validationLevel: 'basic' as const,
        includeWarnings: false,
        includeSuggestions: false
      };

      const validateResult = await validateTool.execute(validateArgs);
      expect((validateResult.content[0] as { type: 'text'; text: string }).text).toContain('VALID');
    });
  });
});
