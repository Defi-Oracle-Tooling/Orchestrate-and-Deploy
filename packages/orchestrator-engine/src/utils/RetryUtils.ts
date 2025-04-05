import { delay } from "@azure/core-http";
import chalk from "chalk";
import { TelemetryService } from "./TelemetryService";

/**
 * Options for retry operations
 */
export interface RetryOptions {
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Initial delay in milliseconds before first retry */
    initialDelayMs?: number;
    /** Maximum delay in milliseconds */
    maxDelayMs?: number;
    /** Whether to use full jitter to randomize delay */
    useJitter?: boolean;
    /** Operation name for telemetry */
    operationName?: string;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
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
export async function executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error | null = null;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            // Track attempt metrics
            if (attempt > 0) {
                TelemetryService.trackEvent(`RetryAttempt`, {
                    operation: config.operationName,
                    attempt: attempt.toString(),
                    maxRetries: config.maxRetries.toString()
                });
            }

            const result = await operation();

            // If successful after retries, log the recovery
            if (attempt > 0) {
                const duration = Date.now() - startTime;
                console.log(chalk.green(`✅ Operation succeeded after ${attempt} retries (${duration}ms)`));
                TelemetryService.trackEvent(`RetrySuccess`, {
                    operation: config.operationName,
                    attempts: attempt.toString(),
                    durationMs: duration.toString()
                });
            }

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            lastError = err;

            if (attempt < config.maxRetries) {
                // Calculate exponential backoff with optional jitter
                let delayMs = Math.min(
                    config.initialDelayMs * Math.pow(2, attempt),
                    config.maxDelayMs
                );

                if (config.useJitter) {
                    // Apply full jitter: random delay between 0 and calculated delay
                    delayMs = Math.floor(Math.random() * delayMs);
                }

                console.log(chalk.yellow(`⚠️ Operation failed (attempt ${attempt + 1}/${config.maxRetries + 1}), retrying in ${delayMs}ms...`));
                console.log(chalk.yellow(`   Error: ${err.message}`));

                TelemetryService.trackEvent(`RetryDelay`, {
                    operation: config.operationName,
                    attempt: (attempt + 1).toString(),
                    delayMs: delayMs.toString(),
                    error: err.message
                });

                await delay(delayMs);
            } else {
                // Final failure after all retry attempts
                const duration = Date.now() - startTime;
                console.log(chalk.red(`❌ Operation failed after ${attempt + 1} attempts (${duration}ms)`));

                TelemetryService.trackEvent(`RetryFailure`, {
                    operation: config.operationName,
                    attempts: (attempt + 1).toString(),
                    durationMs: duration.toString(),
                    error: err.message
                });

                TelemetryService.trackException(err, {
                    operation: config.operationName,
                    attempts: (attempt + 1).toString()
                });
            }
        }
    }

    throw lastError || new Error(`Operation '${config.operationName}' failed after multiple retries`);
}