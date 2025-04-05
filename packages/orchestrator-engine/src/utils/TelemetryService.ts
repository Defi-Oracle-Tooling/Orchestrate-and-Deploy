import * as appInsights from 'applicationinsights';
import chalk from 'chalk';

/**
 * TelemetryService provides centralized logging and telemetry using Azure Application Insights
 */
export class TelemetryService {
    private static client: appInsights.TelemetryClient | null = null;
    private static initialized = false;

    /**
     * Initialize the Application Insights telemetry
     * @returns boolean indicating if initialization was successful
     */
    public static initialize(): boolean {
        if (this.initialized) {
            return true;
        }

        const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

        if (!connectionString) {
            console.log(chalk.yellow('⚠️ Application Insights connection string not set. Telemetry disabled.'));
            return false;
        }

        try {
            appInsights.setup(connectionString)
                .setAutoDependencyCorrelation(true)
                .setAutoCollectRequests(true)
                .setAutoCollectPerformance(true)
                .setAutoCollectExceptions(true)
                .setAutoCollectDependencies(true)
                .setAutoCollectConsole(true)
                .setUseDiskRetryCaching(true)
                .setSendLiveMetrics(true)
                .start();

            this.client = appInsights.defaultClient;
            this.initialized = true;
            console.log(chalk.green('✅ Application Insights telemetry initialized'));
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Failed to initialize Application Insights: ${error instanceof Error ? error.message : String(error)}`));
            return false;
        }
    }

    /**
     * Track a custom event with properties
     * @param name Event name
     * @param properties Optional properties to include with the event
     */
    public static trackEvent(name: string, properties?: { [key: string]: string }): void {
        if (this.client) {
            this.client.trackEvent({ name, properties });
        }

        // Also log to console for local debugging
        const propertiesStr = properties ? ` ${JSON.stringify(properties)}` : '';
        console.log(chalk.blue(`📊 Event: ${name}${propertiesStr}`));
    }

    /**
     * Track an exception with properties
     * @param exception Error object to track
     * @param properties Optional properties to include with the exception
     */
    public static trackException(exception: Error, properties?: { [key: string]: string }): void {
        if (this.client) {
            this.client.trackException({ exception, properties });
        }

        // Also log to console for local debugging
        console.log(chalk.red(`❌ Exception: ${exception.message}`));
        if (properties) {
            console.log(chalk.red(`   Context: ${JSON.stringify(properties)}`));
        }
    }

    /**
     * Track a metric value
     * @param name Metric name
     * @param value Numeric value to track
     */
    public static trackMetric(name: string, value: number): void {
        if (this.client) {
            this.client.trackMetric({ name, value });
        }

        // Also log to console for local debugging
        console.log(chalk.magenta(`📈 Metric: ${name} = ${value}`));
    }

    /**
     * Track dependency call
     * @param name Dependency name
     * @param data Additional data about the dependency
     * @param success Whether the dependency call was successful
     * @param duration Duration of the call in milliseconds
     */
    public static trackDependency(name: string, data: string, success: boolean, duration: number): void {
        if (this.client) {
            this.client.trackDependency({
                name,
                data,
                success,
                duration,
                dependencyTypeName: 'HTTP',
                target: data
            });
        }

        // Also log to console for local debugging
        console.log(chalk.cyan(`🔗 Dependency: ${name} - ${success ? 'Success' : 'Failure'} (${duration}ms)`));
    }

    /**
     * Flush all telemetry immediately rather than waiting for the regular interval
     */
    public static flush(): void {
        if (this.client) {
            this.client.flush();
        }
    }
}