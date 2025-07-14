import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config as dotenvConfig } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration Manager for the Legacy Migration Tool
 * Handles loading and validation of all configuration files
 */
export class ConfigManager {
  static #instance = null;
  static #configCache = null;

  /**
   * Load environment variables
   */
  static loadEnvironmentVariables() {
    // Load .env file
    const envPath = join(__dirname, '..', '..', '.env');
    dotenvConfig({ path: envPath });

    return {
      legacy: {
        baseUrl: process.env.LEGACY_API_URL || 'https://dsapi.sessionupload.com',
        apiKey: process.env.LEGACY_API_KEY,
        bearerToken: process.env.LEGACY_BEARER_TOKEN
      },
      current: {
        eventApiUrl: process.env.CURRENT_EVENT_API_URL || 'https://ss-dev.showsiteserver.com/event-api',
        filesApiUrl: process.env.CURRENT_FILES_API_URL || 'https://ss-dev.showsiteserver.com/files-api',
        bearerToken: process.env.CURRENT_BEARER_TOKEN
      },
      migration: {
        maxConcurrentRooms: parseInt(process.env.MAX_CONCURRENT_ROOMS) || 6,
        enableFileMigration: process.env.ENABLE_FILE_MIGRATION !== 'false',
        logLevel: process.env.LOG_LEVEL || 'info',
        httpTimeout: parseInt(process.env.HTTP_TIMEOUT) || 30000,
        fileUploadTimeout: parseInt(process.env.FILE_UPLOAD_TIMEOUT) || 300000,
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
        retryDelay: parseInt(process.env.RETRY_DELAY) || 1000
      }
    };
  }

  /**
   * Load API endpoints configuration
   */
  static loadApiEndpoints() {
    const configPath = join(__dirname, '..', '..', 'config', 'api-endpoints.json');
    
    try {
      const content = readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load API endpoints configuration: ${error.message}`);
    }
  }

  /**
   * Load DTO configurations
   */
  static loadDTOs() {
    const dtoPath = join(__dirname, '..', '..', 'config', 'dtos');
    
    try {
      const legacyDtos = JSON.parse(readFileSync(join(dtoPath, 'legacy-dtos.json'), 'utf8'));
      const currentDtos = JSON.parse(readFileSync(join(dtoPath, 'current-dtos.json'), 'utf8'));
      
      return {
        legacy: legacyDtos,
        current: currentDtos
      };
    } catch (error) {
      throw new Error(`Failed to load DTO configurations: ${error.message}`);
    }
  }

  /**
   * Load complete configuration
   */
  static load() {
    if (ConfigManager.#configCache) {
      return ConfigManager.#configCache;
    }

    try {
      const env = ConfigManager.loadEnvironmentVariables();
      const apiEndpoints = ConfigManager.loadApiEndpoints();
      const dtos = ConfigManager.loadDTOs();

      ConfigManager.#configCache = {
        environment: env,
        apis: apiEndpoints,
        dtos: dtos,
        // Merge environment and API endpoint configurations
        legacy: {
          ...env.legacy,
          ...apiEndpoints.legacy
        },
        current: {
          ...env.current,
          eventApi: {
            ...apiEndpoints.current.eventApi,
            baseUrl: env.current.eventApiUrl
          },
          filesApi: {
            ...apiEndpoints.current.filesApi,
            baseUrl: env.current.filesApiUrl
          }
        },
        migration: {
          ...env.migration,
          ...apiEndpoints.migration
        }
      };

      return ConfigManager.#configCache;
    } catch (error) {
      throw new Error(`Configuration loading failed: ${error.message}`);
    }
  }

  /**
   * Validate migration configuration
   */
  static validateConfig(config) {
    const errors = [];

    // Validate required fields
    if (!config.legacyEventName || config.legacyEventName.trim() === '') {
      errors.push('Legacy event name is required');
    }

    if (!config.targetEventId || isNaN(config.targetEventId) || config.targetEventId <= 0) {
      errors.push('Target event ID must be a positive number');
    }

    // Validate optional fields
    if (config.maxConcurrentRooms && (isNaN(config.maxConcurrentRooms) || config.maxConcurrentRooms < 1)) {
      errors.push('Max concurrent rooms must be a positive number');
    }

    if (config.timeout && (isNaN(config.timeout) || config.timeout < 1000)) {
      errors.push('Timeout must be at least 1000 milliseconds');
    }

    // Throw if validation fails
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\\n${errors.join('\\n')}`);
    }

    // Return validated and normalized configuration
    return {
      legacyEventName: config.legacyEventName.trim(),
      targetEventId: config.targetEventId,
      roomName: config.roomName?.trim() || null,
      migrateAllRooms: !config.roomName?.trim(),
      verbose: Boolean(config.verbose),
      skipFiles: Boolean(config.skipFiles),
      dryRun: Boolean(config.dryRun),
      maxConcurrentRooms: config.maxConcurrentRooms || null,
      timeout: config.timeout || null
    };
  }

  /**
   * Build endpoint URL with parameter substitution
   */
  static buildEndpointUrl(apiType, endpointKey, params = {}) {
    const config = ConfigManager.load();
    
    let apiConfig;
    let baseUrl;

    // Determine API configuration
    switch (apiType) {
      case 'legacy':
        apiConfig = config.legacy;
        baseUrl = apiConfig.baseUrl;
        break;
      case 'current-event':
        apiConfig = config.current.eventApi;
        baseUrl = apiConfig.baseUrl;
        break;
      case 'current-files':
        apiConfig = config.current.filesApi;
        baseUrl = apiConfig.baseUrl;
        break;
      default:
        throw new Error(`Unknown API type: ${apiType}`);
    }

    // Get endpoint template
    const endpointTemplate = apiConfig.endpoints[endpointKey];
    if (!endpointTemplate) {
      throw new Error(`Endpoint '${endpointKey}' not found for API type '${apiType}'`);
    }

    // Replace parameters in URL
    let url = endpointTemplate;
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    });

    return `${baseUrl}${url}`;
  }

  /**
   * Get authentication headers for API type
   */
  static getAuthHeaders(apiType) {
    const config = ConfigManager.load();
    
    switch (apiType) {
      case 'legacy':
        const headers = {
          'Authorization': `Bearer ${config.legacy.bearerToken}`,
          'x-Client': 'WebAuthToken',
          'Content-Type': 'application/json'
        };
        // Add API key if available
        if (config.legacy.apiKey) {
          headers['x-api-key'] = config.legacy.apiKey;
        }
        return headers;
      case 'current-event':
      case 'current-files':
        return {
          'Authorization': `Bearer ${config.current.bearerToken}`,
          'Content-Type': 'application/json'
        };
      default:
        throw new Error(`Unknown API type for authentication: ${apiType}`);
    }
  }

  /**
   * Get DTO mapping for entity type
   */
  static getDTOMapping(entityType, direction) {
    const config = ConfigManager.load();
    
    if (direction === 'legacy') {
      return config.dtos.legacy[entityType];
    } else if (direction === 'current') {
      return config.dtos.current[entityType];
    }
    
    throw new Error(`Invalid DTO direction: ${direction}`);
  }

  /**
   * Get migration settings
   */
  static getMigrationSettings() {
    const config = ConfigManager.load();
    return config.migration;
  }

  /**
   * Validate environment configuration
   * @returns {boolean} - True if environment is valid
   * @throws {Error} - If environment validation fails
   */
  static validateEnvironment() {
    const requiredVars = [
      'LEGACY_BEARER_TOKEN',
      'CURRENT_BEARER_TOKEN'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate API endpoints
    const config = this.load();
    if (!config.legacy || !config.current?.eventApi || !config.current?.filesApi) {
      throw new Error('Failed to load API configuration');
    }

    return true;
  }

  /**
   * Clear configuration cache (for testing)
   */
  static clearCache() {
    ConfigManager.#configCache = null;
  }

  /**
   * Get configuration summary for logging
   */
  static getConfigSummary() {
    const config = ConfigManager.load();
    
    return {
      legacyApiUrl: config.legacy.baseUrl,
      currentEventApiUrl: config.current.eventApi.baseUrl,
      currentFilesApiUrl: config.current.filesApi.baseUrl,
      maxConcurrentRooms: config.migration.maxConcurrentRooms,
      enableFileMigration: config.migration.enableFileMigration,
      logLevel: config.migration.logLevel,
      httpTimeout: config.migration.httpTimeout,
      fileUploadTimeout: config.migration.fileUploadTimeout
    };
  }
}
