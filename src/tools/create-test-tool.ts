/**
 * Create Test Tool
 * 
 * MCP tool for creating TestCafe test files from structured input.
 */

import { z } from 'zod';
import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import { TestCafeService, TestStructure } from '../services/index.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Input schema for CreateTestTool
 */
export const CreateTestInputSchema = z.object({
  testStructure: z.object({
    fixture: z.string().min(1, 'Fixture name is required'),
    url: z.string().url().optional(),
    tests: z.array(z.object({
      name: z.string().min(1, 'Test name is required'),
      actions: z.array(z.object({
        type: z.enum(['navigate', 'click', 'type', 'wait', 'assert']),
        selector: z.string().optional(),
        value: z.string().optional(),
        timeout: z.number().min(100).max(60000).optional()
      })).min(1, 'At least one action is required')
    })).min(1, 'At least one test is required')
  }),
  outputPath: z.string().min(1, 'Output path is required').default('./test.js'),
  validate: z.boolean().default(true)
});

export type CreateTestInput = z.infer<typeof CreateTestInputSchema>;

/**
 * Create Test Tool
 * 
 * Creates TestCafe test files from structured test definitions.
 */
export class CreateTestTool implements MCPTool {
  name = 'create_test';
  description = 'Create a TestCafe test file from structured test definition';
  inputSchema = CreateTestInputSchema;

  private testCafeService: TestCafeService;

  constructor(testCafeService: TestCafeService) {
    this.testCafeService = testCafeService;
  }

  async execute(args: CreateTestInput): Promise<CallToolResult> {
    try {
      // Validate test structure
      if (args.validate) {
        const validation = this.testCafeService.validateTestStructure(args.testStructure);
        if (!validation.isValid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Test structure validation failed: ${validation.errors.join(', ')}`,
            { validationErrors: validation.errors }
          );
        }
      }

      // Generate test code
      const testCode = this.testCafeService.createTestFile(args.testStructure as TestStructure);

      // Validate generated code
      const codeValidation = this.testCafeService.validateTestCode(testCode);
      if (!codeValidation.isValid) {
        throw new McpError(
          ErrorCode.InternalError,
          `Generated test code validation failed: ${codeValidation.errors.join(', ')}`,
          { 
            generatedCode: testCode,
            validationErrors: codeValidation.errors 
          }
        );
      }

      // Write test file
      try {
        await writeFile(args.outputPath, testCode, 'utf8');
      } catch (writeError) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to write test file: ${writeError instanceof Error ? writeError.message : String(writeError)}`,
          { outputPath: args.outputPath }
        );
      }

      // Prepare result
      const result: CallToolResult = {
        content: [
          {
            type: 'text',
            text: `Successfully created TestCafe test file at: ${args.outputPath}`
          },
          {
            type: 'text',
            text: `Test structure:\n- Fixture: ${args.testStructure.fixture}\n- Tests: ${args.testStructure.tests.length}\n- Total actions: ${args.testStructure.tests.reduce((sum, test) => sum + test.actions.length, 0)}`
          }
        ]
      };

      // Add warnings if any
      if (codeValidation.warnings.length > 0) {
        result.content.push({
          type: 'text',
          text: `Warnings:\n${codeValidation.warnings.map(w => `- ${w}`).join('\n')}`
        });
      }

      // Add generated code preview
      result.content.push({
        type: 'text',
        text: `Generated test code:\n\`\`\`javascript\n${testCode}\n\`\`\``
      });

      return result;

    } catch (error) {
      // Re-throw MCP errors
      if (error instanceof McpError) {
        throw error;
      }

      // Handle other errors
      throw new McpError(
        ErrorCode.InternalError,
        `Test creation failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  /**
   * Create a simple test structure for quick testing
   */
  static createSimpleTest(
    fixtureName: string,
    url: string,
    testName: string,
    actions: Array<{ type: string; selector?: string; value?: string }>
  ): CreateTestInput {
    return {
      testStructure: {
        fixture: fixtureName,
        url,
        tests: [{
          name: testName,
          actions: actions.map(action => ({
            type: action.type as any,
            selector: action.selector,
            value: action.value
          }))
        }]
      },
      outputPath: './test.js',
      validate: true
    };
  }

  /**
   * Validate test structure without creating file
   */
  async validateOnly(testStructure: unknown): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    generatedCode?: string;
  }> {
    try {
      // Validate structure
      const structureValidation = this.testCafeService.validateTestStructure(testStructure);
      if (!structureValidation.isValid) {
        return {
          isValid: false,
          errors: structureValidation.errors,
          warnings: structureValidation.warnings
        };
      }

      // Generate and validate code
      const testCode = this.testCafeService.createTestFile(testStructure as TestStructure);
      const codeValidation = this.testCafeService.validateTestCode(testCode);

      return {
        isValid: codeValidation.isValid,
        errors: codeValidation.errors,
        warnings: [...structureValidation.warnings, ...codeValidation.warnings],
        generatedCode: testCode
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
    }
  }
}