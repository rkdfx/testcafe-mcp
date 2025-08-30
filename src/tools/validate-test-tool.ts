/**
 * Validate Test Tool
 * 
 * MCP tool for validating TestCafe test syntax and structure.
 */

import { z } from 'zod';
import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool } from '../server.js';
import { TestCafeService, TestValidationResult } from '../services/index.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Input schema for ValidateTestTool
 */
export const ValidateTestInputSchema = z.object({
  source: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('file'),
      path: z.string().min(1, 'File path is required')
    }),
    z.object({
      type: z.literal('code'),
      content: z.string().min(1, 'Test code content is required')
    }),
    z.object({
      type: z.literal('structure'),
      testStructure: z.object({
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
        }))
      })
    })
  ]),
  validationLevel: z.enum(['basic', 'strict', 'comprehensive']).default('basic'),
  includeWarnings: z.boolean().default(true),
  includeSuggestions: z.boolean().default(false)
});

export type ValidateTestInput = z.infer<typeof ValidateTestInputSchema>;

/**
 * Validation severity levels
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  SUGGESTION = 'suggestion'
}

/**
 * Detailed validation issue
 */
export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  line?: number;
  column?: number;
  rule?: string;
  suggestion?: string;
}

/**
 * Comprehensive validation result
 */
export interface ComprehensiveValidationResult extends TestValidationResult {
  issues: ValidationIssue[];
  suggestions: string[];
  metrics: {
    linesOfCode: number;
    testCount: number;
    fixtureCount: number;
    actionCount: number;
    complexity: number;
  };
}

/**
 * Validate Test Tool
 * 
 * Provides comprehensive TestCafe test validation with multiple severity levels.
 */
export class ValidateTestTool implements MCPTool {
  name = 'validate_test';
  description = 'Validate TestCafe test syntax, structure, and best practices';
  inputSchema = ValidateTestInputSchema;

  private testCafeService: TestCafeService;

  constructor(testCafeService: TestCafeService) {
    this.testCafeService = testCafeService;
  }

  async execute(args: ValidateTestInput): Promise<CallToolResult> {
    try {
      let testCode: string;
      let validationResult: ComprehensiveValidationResult;

      // Get test content based on source type
      switch (args.source.type) {
        case 'file':
          testCode = await this.loadTestFile(args.source.path);
          validationResult = await this.validateTestCode(testCode, args);
          break;

        case 'code':
          testCode = args.source.content;
          validationResult = await this.validateTestCode(testCode, args);
          break;

        case 'structure':
          validationResult = await this.validateTestStructure(args.source.testStructure, args);
          testCode = this.testCafeService.createTestFile(args.source.testStructure);
          break;

        default:
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid source type specified'
          );
      }

      return this.formatValidationResult(validationResult, args, testCode);

    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Test validation failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  /**
   * Validate test code with comprehensive analysis
   */
  async validateTestCode(testCode: string, options: ValidateTestInput): Promise<ComprehensiveValidationResult> {
    // Basic validation using TestCafe service
    const basicValidation = this.testCafeService.validateTestCode(testCode);
    
    // Enhanced validation
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];
    const metrics = this.calculateMetrics(testCode);

    // Convert basic errors to issues
    basicValidation.errors.forEach(error => {
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: error,
        rule: 'syntax'
      });
    });

    // Convert basic warnings to issues
    if (options.includeWarnings) {
      basicValidation.warnings.forEach(warning => {
        issues.push({
          severity: ValidationSeverity.WARNING,
          message: warning,
          rule: 'best-practice'
        });
      });
    }

    // Perform additional validation based on level
    switch (options.validationLevel) {
      case 'comprehensive':
        this.performComprehensiveValidation(testCode, issues, suggestions);
        // fall through
      case 'strict':
        this.performStrictValidation(testCode, issues, suggestions);
        // fall through
      case 'basic':
        this.performBasicValidation(testCode, issues, suggestions);
        break;
    }

    // Add suggestions if requested
    if (options.includeSuggestions) {
      this.generateSuggestions(testCode, metrics, suggestions);
    }

    return {
      isValid: basicValidation.isValid && !issues.some(i => i.severity === ValidationSeverity.ERROR),
      errors: issues.filter(i => i.severity === ValidationSeverity.ERROR).map(i => i.message),
      warnings: issues.filter(i => i.severity === ValidationSeverity.WARNING).map(i => i.message),
      issues,
      suggestions,
      metrics
    };
  }

  /**
   * Validate test structure
   */
  async validateTestStructure(testStructure: any, options: ValidateTestInput): Promise<ComprehensiveValidationResult> {
    const structureValidation = this.testCafeService.validateTestStructure(testStructure);
    
    // Generate code for additional validation
    let testCode = '';
    try {
      testCode = this.testCafeService.createTestFile(testStructure);
    } catch (error) {
      // Handle code generation errors
    }

    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];
    const metrics = testCode ? this.calculateMetrics(testCode) : {
      linesOfCode: 0,
      testCount: testStructure.tests?.length || 0,
      fixtureCount: 1,
      actionCount: testStructure.tests?.reduce((sum: number, test: any) => sum + (test.actions?.length || 0), 0) || 0,
      complexity: 1
    };

    // Convert structure validation results
    structureValidation.errors.forEach(error => {
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: error,
        rule: 'structure'
      });
    });

    if (options.includeWarnings) {
      structureValidation.warnings.forEach(warning => {
        issues.push({
          severity: ValidationSeverity.WARNING,
          message: warning,
          rule: 'structure'
        });
      });
    }

    // Validate test structure specifics
    this.validateTestStructureSpecifics(testStructure, issues, suggestions);

    return {
      isValid: structureValidation.isValid && !issues.some(i => i.severity === ValidationSeverity.ERROR),
      errors: issues.filter(i => i.severity === ValidationSeverity.ERROR).map(i => i.message),
      warnings: issues.filter(i => i.severity === ValidationSeverity.WARNING).map(i => i.message),
      issues,
      suggestions,
      metrics
    };
  }

  /**
   * Load test file content
   */
  private async loadTestFile(filePath: string): Promise<string> {
    if (!existsSync(filePath)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Test file not found: ${filePath}`,
        { filePath }
      );
    }

    try {
      return await readFile(filePath, 'utf8');
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read test file: ${error instanceof Error ? error.message : String(error)}`,
        { filePath }
      );
    }
  }

  /**
   * Calculate code metrics
   */
  private calculateMetrics(testCode: string): ComprehensiveValidationResult['metrics'] {
    const lines = testCode.split('\n');
    const linesOfCode = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;
    
    const fixtureMatches = testCode.match(/fixture\s*\(/g) || [];
    const testMatches = testCode.match(/test\s*\(/g) || [];
    const actionMatches = testCode.match(/await\s+t\./g) || [];
    
    // Simple complexity calculation based on control structures and actions
    const complexityMatches = testCode.match(/\b(if|for|while|switch|try|catch)\b/g) || [];
    const complexity = Math.max(1, complexityMatches.length + actionMatches.length * 0.1);

    return {
      linesOfCode,
      testCount: testMatches.length,
      fixtureCount: fixtureMatches.length,
      actionCount: actionMatches.length,
      complexity: Math.round(complexity * 10) / 10
    };
  }

  /**
   * Perform basic validation checks
   */
  private performBasicValidation(testCode: string, issues: ValidationIssue[], suggestions: string[]): void {
    // Check for common anti-patterns
    if (testCode.includes('sleep(') || testCode.includes('setTimeout(')) {
      issues.push({
        severity: ValidationSeverity.WARNING,
        message: 'Avoid using sleep() or setTimeout(), use TestCafe wait methods instead',
        rule: 'no-sleep'
      });
    }

    // Check for hardcoded waits
    const hardcodedWaits = testCode.match(/wait\(\s*\d{4,}\s*\)/g);
    if (hardcodedWaits) {
      issues.push({
        severity: ValidationSeverity.WARNING,
        message: 'Long hardcoded waits detected, consider using element-based waits',
        rule: 'no-long-waits'
      });
    }
  }

  /**
   * Perform strict validation checks
   */
  private performStrictValidation(testCode: string, issues: ValidationIssue[], suggestions: string[]): void {
    // Check for proper error handling
    if (testCode.includes('try') && !testCode.includes('catch')) {
      issues.push({
        severity: ValidationSeverity.WARNING,
        message: 'Try blocks should have corresponding catch blocks',
        rule: 'proper-error-handling'
      });
    }

    // Check for page object pattern usage
    if (testCode.includes('Selector(') && testCode.split('Selector(').length > 5) {
      suggestions.push('Consider using Page Object pattern for better maintainability');
    }
  }

  /**
   * Perform comprehensive validation checks
   */
  private performComprehensiveValidation(testCode: string, issues: ValidationIssue[], suggestions: string[]): void {
    // Check for accessibility considerations
    if (!testCode.includes('role=') && !testCode.includes('aria-')) {
      suggestions.push('Consider using accessibility-friendly selectors (role, aria attributes)');
    }

    // Check for test data management
    if (testCode.includes("'test@") || testCode.includes('"test@')) {
      issues.push({
        severity: ValidationSeverity.INFO,
        message: 'Hardcoded test data detected, consider using data providers',
        rule: 'no-hardcoded-data'
      });
    }
  }

  /**
   * Validate test structure specifics
   */
  private validateTestStructureSpecifics(testStructure: any, issues: ValidationIssue[], suggestions: string[]): void {
    // Check fixture name
    if (testStructure.fixture && testStructure.fixture.length < 3) {
      issues.push({
        severity: ValidationSeverity.WARNING,
        message: 'Fixture name should be descriptive (at least 3 characters)',
        rule: 'descriptive-names'
      });
    }

    // Check test names
    testStructure.tests?.forEach((test: any, index: number) => {
      if (test.name && test.name.length < 5) {
        issues.push({
          severity: ValidationSeverity.WARNING,
          message: `Test ${index + 1} name should be more descriptive`,
          rule: 'descriptive-names'
        });
      }
    });

    // Check for missing assertions
    testStructure.tests?.forEach((test: any, index: number) => {
      const hasAssertions = test.actions?.some((action: any) => action.type === 'assert');
      if (!hasAssertions) {
        issues.push({
          severity: ValidationSeverity.WARNING,
          message: `Test ${index + 1} has no assertions`,
          rule: 'missing-assertions'
        });
      }
    });
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(testCode: string, metrics: ComprehensiveValidationResult['metrics'], suggestions: string[]): void {
    if (metrics.complexity > 5) {
      suggestions.push('Consider breaking down complex tests into smaller, focused tests');
    }

    if (metrics.testCount > 10) {
      suggestions.push('Large test files can be hard to maintain, consider splitting into multiple files');
    }

    if (metrics.actionCount / metrics.testCount > 10) {
      suggestions.push('Tests with many actions might be testing too much, consider focusing on single behaviors');
    }
  }

  /**
   * Format validation result for MCP response
   */
  private formatValidationResult(
    result: ComprehensiveValidationResult,
    args: ValidateTestInput,
    testCode?: string
  ): CallToolResult {
    const content: CallToolResult['content'] = [];

    // Add validation summary
    const status = result.isValid ? '✅ VALID' : '❌ INVALID';
    content.push({
      type: 'text',
      text: `Validation Result: ${status}\n\nSummary:\n- Errors: ${result.errors.length}\n- Warnings: ${result.warnings.length}\n- Issues: ${result.issues.length}\n- Suggestions: ${result.suggestions.length}`
    });

    // Add metrics
    content.push({
      type: 'text',
      text: `Code Metrics:\n- Lines of Code: ${result.metrics.linesOfCode}\n- Fixtures: ${result.metrics.fixtureCount}\n- Tests: ${result.metrics.testCount}\n- Actions: ${result.metrics.actionCount}\n- Complexity: ${result.metrics.complexity}`
    });

    // Add detailed issues
    if (result.issues.length > 0) {
      const issuesByType = result.issues.reduce((acc, issue) => {
        if (!acc[issue.severity]) acc[issue.severity] = [];
        acc[issue.severity].push(issue);
        return acc;
      }, {} as Record<string, ValidationIssue[]>);

      let issuesText = 'Detailed Issues:\n';
      Object.entries(issuesByType).forEach(([severity, issues]) => {
        const icon = severity === 'error' ? '❌' : severity === 'warning' ? '⚠️' : 'ℹ️';
        issuesText += `\n${severity.toUpperCase()}:\n`;
        issues.forEach(issue => {
          issuesText += `${icon} ${issue.message}`;
          if (issue.rule) issuesText += ` (${issue.rule})`;
          if (issue.suggestion) issuesText += `\n   💡 ${issue.suggestion}`;
          issuesText += '\n';
        });
      });

      content.push({
        type: 'text',
        text: issuesText
      });
    }

    // Add suggestions
    if (result.suggestions.length > 0) {
      content.push({
        type: 'text',
        text: `Suggestions:\n${result.suggestions.map(s => `💡 ${s}`).join('\n')}`
      });
    }

    return { content };
  }
}