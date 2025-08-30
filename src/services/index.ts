/**
 * Services module exports
 */

export { TestCafeService } from './testcafe-service.js';
export { BrowserInteractionService } from './browser-interaction-service.js';
export { PageInspectionService } from './page-inspection-service.js';
export { PerformanceMonitor, performanceMonitor } from './performance-monitor.js';

export type {
  TestStructure,
  TestExecutionResult,
  TestValidationResult
} from './testcafe-service.js';

export type {
  BrowserAction,
  ClickAction,
  TypeAction,
  NavigateAction,
  WaitAction,
  AssertAction,
  ElementInfo,
  SelectorSuggestion
} from './browser-interaction-service.js';

export type {
  PageInspectionOptions,
  ElementDiscoveryResult,
  PageStructureAnalysis
} from './page-inspection-service.js';