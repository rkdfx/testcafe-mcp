/**
 * Shared utilities for TestCafe test runner operations.
 *
 * Consolidates duplicated helper functions used across services and tools.
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Escape a string for safe embedding in generated JavaScript code.
 * Escapes backslashes, single quotes, double quotes, newlines, carriage returns,
 * and tabs in that order.
 */
export function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Write test code to a temporary file and return the file path.
 *
 * @param testCode - The JavaScript test code to write.
 * @param prefix   - Prefix for the temporary directory (default: 'testcafe-').
 * @param filename - Name of the file inside the temp directory (default: 'test.js').
 * @returns Absolute path to the created temp file.
 */
export async function createTempTestFile(
  testCode: string,
  prefix = 'testcafe-',
  filename = 'test.js'
): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const tempFile = path.join(tempDir, filename);
  await fs.writeFile(tempFile, testCode, 'utf8');
  return tempFile;
}

/**
 * Remove a temporary test file and its parent directory.
 * All errors are silently ignored.
 *
 * @param filePath - Absolute path to the temp file.
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
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
 * Run a TestCafe runner while capturing all console.log output.
 *
 * @param runner     - A TestCafe runner instance (already configured with src/browsers).
 * @param runOptions - Options forwarded to runner.run().
 * @returns All text that was written to console.log during the run.
 */
export async function captureRunnerOutput(
  runner: any,
  runOptions: Record<string, any>
): Promise<string> {
  let capturedOutput = '';
  const originalLog = console.log;

  console.log = (...args: any[]) => {
    const message = args.join(' ');
    capturedOutput += message + '\n';
  };

  try {
    await runner.run(runOptions);
  } finally {
    console.log = originalLog;
  }

  return capturedOutput;
}
