"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const appInsights = __importStar(require("applicationinsights"));
const chalk_1 = __importDefault(require("chalk"));
/**
 * TelemetryService provides centralized logging and telemetry using Azure Application Insights
 */
class TelemetryService {
    /**
     * Initialize the Application Insights telemetry
     * @returns boolean indicating if initialization was successful
     */
    static initialize() {
        if (this.initialized) {
            return true;
        }
        const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
        if (!connectionString) {
            console.log(chalk_1.default.yellow('⚠️ Application Insights connection string not set. Telemetry disabled.'));
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
            console.log(chalk_1.default.green('✅ Application Insights telemetry initialized'));
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to initialize Application Insights: ${error instanceof Error ? error.message : String(error)}`));
            return false;
        }
    }
    /**
     * Track a custom event with properties
     * @param name Event name
     * @param properties Optional properties to include with the event
     */
    static trackEvent(name, properties) {
        if (this.client) {
            this.client.trackEvent({ name, properties });
        }
        // Also log to console for local debugging
        const propertiesStr = properties ? ` ${JSON.stringify(properties)}` : '';
        console.log(chalk_1.default.blue(`📊 Event: ${name}${propertiesStr}`));
    }
    /**
     * Track an exception with properties
     * @param exception Error object to track
     * @param properties Optional properties to include with the exception
     */
    static trackException(exception, properties) {
        if (this.client) {
            this.client.trackException({ exception, properties });
        }
        // Also log to console for local debugging
        console.log(chalk_1.default.red(`❌ Exception: ${exception.message}`));
        if (properties) {
            console.log(chalk_1.default.red(`   Context: ${JSON.stringify(properties)}`));
        }
    }
    /**
     * Track a metric value
     * @param name Metric name
     * @param value Numeric value to track
     */
    static trackMetric(name, value) {
        if (this.client) {
            this.client.trackMetric({ name, value });
        }
        // Also log to console for local debugging
        console.log(chalk_1.default.magenta(`📈 Metric: ${name} = ${value}`));
    }
    /**
     * Track dependency call
     * @param name Dependency name
     * @param data Additional data about the dependency
     * @param success Whether the dependency call was successful
     * @param duration Duration of the call in milliseconds
     */
    static trackDependency(name, data, success, duration) {
        if (this.client) {
            this.client.trackDependency({
                name,
                data,
                success,
                duration,
                dependencyTypeName: 'HTTP',
                target: data,
                resultCode: success ? '200' : '500' // Adding required resultCode property
            });
        }
        // Also log to console for local debugging
        console.log(chalk_1.default.cyan(`🔗 Dependency: ${name} - ${success ? 'Success' : 'Failure'} (${duration}ms)`));
    }
    /**
     * Flush all telemetry immediately rather than waiting for the regular interval
     */
    static flush() {
        if (this.client) {
            this.client.flush();
        }
    }
}
exports.TelemetryService = TelemetryService;
TelemetryService.client = null;
TelemetryService.initialized = false;
