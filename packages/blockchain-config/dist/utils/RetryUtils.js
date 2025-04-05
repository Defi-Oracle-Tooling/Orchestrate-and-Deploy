"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeWithRetry = void 0;
// RetryUtils.ts - implements Azure best practice retry pattern with exponential backoff
const chalk_1 = __importDefault(require("chalk"));
const TelemetryService_1 = require("./TelemetryService");
/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    useJitter: true,
    operationName: 'Unknown Operation'
};
/**
 * Executes an operation with retry logic using exponential backoff
 * @param operation Function to execute with retry
 * @param options Retry configuration options
 * @returns Result of the operation or throws after max retries
 */
async function executeWithRetry(operation, options) {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError = null;
    const startTime = Date.now();
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            // Track attempt metrics
            if (attempt > 0) {
                TelemetryService_1.TelemetryService.trackEvent(`RetryAttempt`, {
                    operation: config.operationName,
                    attempt: attempt.toString(),
                    maxRetries: config.maxRetries.toString()
                });
            }
            const result = await operation();
            // If successful after retries, log the recovery
            if (attempt > 0) {
                const duration = Date.now() - startTime;
                console.log(chalk_1.default.green(`✅ Operation succeeded after ${attempt} retries (${duration}ms)`));
                TelemetryService_1.TelemetryService.trackEvent(`RetrySuccess`, {
                    operation: config.operationName,
                    attempts: attempt.toString(),
                    durationMs: duration.toString()
                });
            }
            return result;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            lastError = err;
            if (attempt < config.maxRetries) {
                // Calculate exponential backoff with optional jitter
                let delayMs = Math.min(config.initialDelayMs * Math.pow(2, attempt), config.maxDelayMs);
                if (config.useJitter) {
                    // Apply full jitter: random delay between 0 and calculated delay
                    delayMs = Math.floor(Math.random() * delayMs);
                }
                console.log(chalk_1.default.yellow(`⚠️ Operation failed (attempt ${attempt + 1}/${config.maxRetries + 1}), retrying in ${delayMs}ms...`));
                console.log(chalk_1.default.yellow(`   Error: ${err.message}`));
                TelemetryService_1.TelemetryService.trackEvent(`RetryDelay`, {
                    operation: config.operationName,
                    attempt: (attempt + 1).toString(),
                    delayMs: delayMs.toString(),
                    error: err.message
                });
                // Use setTimeout instead of deprecated delay function
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            else {
                // Final failure after all retry attempts
                const duration = Date.now() - startTime;
                console.log(chalk_1.default.red(`❌ Operation failed after ${attempt + 1} attempts (${duration}ms)`));
                TelemetryService_1.TelemetryService.trackEvent(`RetryFailure`, {
                    operation: config.operationName,
                    attempts: (attempt + 1).toString(),
                    durationMs: duration.toString(),
                    error: err.message
                });
                TelemetryService_1.TelemetryService.trackException(err, {
                    operation: config.operationName,
                    attempts: (attempt + 1).toString()
                });
            }
        }
    }
    throw lastError || new Error(`Operation '${config.operationName}' failed after multiple retries`);
}
exports.executeWithRetry = executeWithRetry;
