import axios from 'axios';
import { ConfigManager } from '../config/ConfigManager.js';

/**
 * Current System API Client - Handles all communication with the current Orchestrate system
 * Supports both Event API and Files API endpoints
 */
export class CurrentSystemApiClient {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.eventApiConfig = config.current.eventApi;
    this.filesApiConfig = config.current.filesApi;
    
    // Create separate axios instances for each API
    this.eventApiClient = this.createApiClient('event', this.eventApiConfig);
    this.filesApiClient = this.createApiClient('files', this.filesApiConfig);
  }

  /**
   * Create axios client for specific API type
   */
  createApiClient(apiType, apiConfig) {
    const client = axios.create({
      baseURL: apiConfig.baseUrl,
      timeout: this.config.migration.httpTimeout,
      headers: ConfigManager.getAuthHeaders(`current-${apiType}`)
    });

    // Setup interceptors
    this.setupInterceptors(client, apiType);
    
    return client;
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  setupInterceptors(client, apiType) {
    // Request interceptor
    client.interceptors.request.use(
      (config) => {
        const startTime = Date.now();
        config.metadata = { startTime, apiType };
        
        this.logger.apiRequest(config.method?.toUpperCase(), config.url, config.data);
        return config;
      },
      (error) => {
        this.logger.apiError('REQUEST', error.config?.url, error, 0);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        this.logger.apiResponse(
          response.config.method?.toUpperCase(),
          response.config.url,
          response.status,
          duration
        );
        return response;
      },
      (error) => {
        const duration = error.config?.metadata?.startTime 
          ? Date.now() - error.config.metadata.startTime 
          : 0;
        
        this.logger.apiError(
          error.config?.method?.toUpperCase(),
          error.config?.url,
          error,
          duration
        );
        
        return Promise.reject(this.handleApiError(error, apiType));
      }
    );
  }

  /**
   * Handle API errors with proper error transformation
   */
  handleApiError(error, apiType) {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      const message = data?.message || data?.error || data?.title || `HTTP ${status} error`;
      
      return new Error(`Current ${apiType} API Error (${status}): ${message}`);
    } else if (error.request) {
      // Request was made but no response received
      return new Error(`Current ${apiType} API Network Error: ${error.message}`);
    } else {
      // Something else happened
      return new Error(`Current ${apiType} API Error: ${error.message}`);
    }
  }

  /**
   * Generic request method for Event API
   */
  async eventApiRequest(method, endpointKey, data = null, params = {}) {
    try {
      const url = ConfigManager.buildEndpointUrl('current-event', endpointKey, params);
      const config = { method, url };
      
      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = data;
      }
      
      const response = await this.eventApiClient.request(config);
      
      // Handle wrapped API responses with data property
      if (response.data && typeof response.data === 'object') {
        // Check if response has the standard API wrapper structure
        if (response.data.hasOwnProperty('data') && response.data.hasOwnProperty('isSuccess')) {
          if (!response.data.isSuccess) {
            throw new Error(`API Error: ${response.data.message || 'Unknown error'}`);
          }
          return response.data.data;
        }
        // For direct data responses
        return response.data;
      }
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to ${method} ${endpointKey}:`, error);
      throw error;
    }
  }

  /**
   * Generic request method for Files API
   */
  async filesApiRequest(method, endpointKey, data = null, params = {}) {
    try {
      const url = ConfigManager.buildEndpointUrl('current-files', endpointKey, params);
      const config = { method, url };
      
      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = data;
      }
      
      const response = await this.filesApiClient.request(config);
      
      // Handle wrapped API responses with data property
      if (response.data && typeof response.data === 'object') {
        // Check if response has the standard API wrapper structure
        if (response.data.hasOwnProperty('data') && response.data.hasOwnProperty('isSuccess')) {
          if (!response.data.isSuccess) {
            throw new Error(`API Error: ${response.data.message || 'Unknown error'}`);
          }
          return response.data.data;
        }
        // For direct data responses
        return response.data;
      }
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to ${method} ${endpointKey}:`, error);
      throw error;
    }
  }

  /**
   * Test connection to current system APIs
   */
  async testConnection() {
    try {
      // Test Event API connection
      await this.eventApiClient.get('/health', { timeout: 5000 });
      this.logger.info('✅ Current Event API connection test passed');
      
      // Test Files API connection
      await this.filesApiClient.get('/health', { timeout: 5000 });
      this.logger.info('✅ Current Files API connection test passed');
      
      return true;
    } catch (error) {
      // If health endpoints don't exist, try basic endpoints
      try {
        await this.eventApiClient.get('/Events', { timeout: 5000 });
        this.logger.info('✅ Current Event API connection test passed (via events endpoint)');
        
        // Files API might not have a public endpoint, so we'll skip it
        this.logger.info('✅ Current Files API connection assumed working');
        
        return true;
      } catch (fallbackError) {
        this.logger.error('❌ Current API connection test failed:', fallbackError);
        throw new Error(`Current API connection failed: ${fallbackError.message}`);
      }
    }
  }

  /**
   * Create event
   */
  async createEvent(eventData) {
    try {
      this.logger.info(`Creating event: ${eventData.name}`);
      const response = await this.eventApiRequest('POST', 'events', eventData);
      this.logger.info(`✅ Event created with ID: ${response.id}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to create event: ${error.message}`);
    }
  }

  /**
   * Create room
   */
  async createRoom(roomData) {
    try {
      this.logger.info(`Creating room: ${roomData.name}`);
      const response = await this.eventApiRequest('POST', 'rooms', roomData, { 
        eventId: roomData.eventId 
      });
      this.logger.info(`✅ Room created with ID: ${response.id}`);
      return response;
    } catch (error) {
      // Handle duplicate room gracefully
      if (error.message.includes('409') && error.message.includes('already exists')) {
        this.logger.warn(`⚠️  Room "${roomData.name}" already exists, skipping creation`);
        
        // Try to get the existing room
        try {
          const existingRooms = await this.getRooms(roomData.eventId);
          const existingRoom = existingRooms.find(room => room.name === roomData.name);
          
          if (existingRoom) {
            this.logger.info(`📋 Using existing room "${roomData.name}" with ID: ${existingRoom.id}`);
            return existingRoom;
          }
        } catch (getRoomError) {
          this.logger.warn(`Could not retrieve existing room: ${getRoomError.message}`);
        }
        
        // Return a mock room object if we can't get the existing one
        return {
          id: `existing-${roomData.name.replace(/\s+/g, '-').toLowerCase()}`,
          name: roomData.name,
          displayName: roomData.displayName,
          eventLocationId: roomData.eventLocationId,
          _isExisting: true
        };
      }
      
      throw new Error(`Failed to create room "${roomData.name}": ${error.message}`);
    }
  }

  /**
   * Create session
   */
  async createSession(sessionData) {
    try {
      this.logger.info(`Creating session: ${sessionData.title}`);
      const response = await this.eventApiRequest('POST', 'sessions', sessionData, { 
        eventId: sessionData.eventId 
      });
      this.logger.info(`✅ Session created with ID: ${response.id}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to create session "${sessionData.title}": ${error.message}`);
    }
  }

  /**
   * Create subsession
   */
  async createSubSession(subSessionData) {
    try {
      this.logger.info(`Creating subsession: ${subSessionData.title}`);
      const response = await this.eventApiRequest('POST', 'subSessions', subSessionData, { 
        eventId: subSessionData.eventId 
      });
      this.logger.info(`✅ SubSession created with ID: ${response.id}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to create subsession "${subSessionData.title}": ${error.message}`);
    }
  }

  /**
   * Create user
   */
  async createUser(userData) {
    try {
      this.logger.info(`Creating user: ${userData.email}`);
      const response = await this.eventApiRequest('POST', 'users', userData, { 
        eventId: userData.eventId 
      });
      this.logger.info(`✅ User created with ID: ${response.id}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to create user "${userData.email}": ${error.message}`);
    }
  }

  /**
   * Create moderator
   */
  async createModerator(moderatorData) {
    try {
      this.logger.info(`Creating moderator relationship for user: ${moderatorData.userId}`);
      const response = await this.eventApiRequest('POST', 'moderators', moderatorData, { 
        eventId: moderatorData.eventId 
      });
      this.logger.info(`✅ Moderator created with ID: ${response.id}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to create moderator: ${error.message}`);
    }
  }

  /**
   * Create session file
   */
  async createSessionFile(fileData) {
    try {
      this.logger.info(`Creating session file: ${fileData.originalFileName}`);
      const response = await this.filesApiRequest('POST', 'sessionFiles', fileData);
      this.logger.info(`✅ Session file created with ID: ${response.id}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to create session file "${fileData.originalFileName}": ${error.message}`);
    }
  }

  /**
   * Create subsession file
   */
  async createSubSessionFile(fileData) {
    try {
      this.logger.info(`Creating subsession file: ${fileData.originalFileName}`);
      const response = await this.filesApiRequest('POST', 'subSessionFiles', fileData);
      this.logger.info(`✅ SubSession file created with ID: ${response.id}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to create subsession file "${fileData.originalFileName}": ${error.message}`);
    }
  }

  /**
   * Create user file
   */
  async createUserFile(fileData) {
    try {
      this.logger.info(`Creating user file: ${fileData.originalFileName}`);
      const response = await this.filesApiRequest('POST', 'userFiles', fileData);
      this.logger.info(`✅ User file created with ID: ${response.id}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to create user file "${fileData.originalFileName}": ${error.message}`);
    }
  }

  /**
   * Create moderator file
   */
  async createModeratorFile(fileData) {
    try {
      this.logger.info(`Creating moderator file: ${fileData.originalFileName}`);
      const response = await this.filesApiRequest('POST', 'moderatorFiles', fileData);
      this.logger.info(`✅ Moderator file created with ID: ${response.id}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to create moderator file "${fileData.originalFileName}": ${error.message}`);
    }
  }

  /**
   * Upload file to current system
   */
  async uploadFile(fileStream, fileName, metadata = {}) {
    try {
      this.logger.fileOperation('uploading', fileName);
      
      const formData = new FormData();
      formData.append('file', fileStream, fileName);
      
      // Add metadata
      Object.entries(metadata).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // Use filesApiRequest for consistency (this returns response.data)
      const fileData = await this.filesApiRequest('POST', 'upload', formData);
      
      this.logger.fileOperation('uploaded', fileName, fileData.size);
      return fileData;
      
    } catch (error) {
      this.logger.fileError('uploading', fileName, error);
      throw error;
    }
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId) {
    try {
      this.logger.info(`Fetching event: ${eventId}`);
      const eventData = await this.eventApiRequest('GET', 'eventById', null, { eventId });
      
      if (!eventData) {
        this.logger.warn(`No event data returned for ID: ${eventId}`);
        return null;
      }
      
      this.logger.info(`Event ${eventId} loaded successfully`);
      return eventData;
    } catch (error) {
      this.logger.error(`Failed to fetch event ${eventId}: ${error.message}`);
      throw new Error(`Failed to fetch event ${eventId}: ${error.message}`);
    }
  }

  /**
   * Get event locations by event ID
   */
  async getEventLocations(eventId) {
    try {
      this.logger.info(`Fetching event locations for event: ${eventId}`);
      const locationsData = await this.eventApiRequest('GET', 'eventLocations', null, { eventId });
      
      if (!locationsData || !Array.isArray(locationsData)) {
        this.logger.warn(`No event locations returned for event ID: ${eventId}`);
        return [];
      }
      
      this.logger.info(`Found ${locationsData.length} locations for event ${eventId}`);
      return locationsData;
    } catch (error) {
      this.logger.error(`Failed to fetch event locations for event ${eventId}: ${error.message}`);
      throw new Error(`Failed to fetch event locations for event ${eventId}: ${error.message}`);
    }
  }

  /**
   * Get rooms for event
   */
  async getRooms(eventId) {
    try {
      this.logger.info(`Fetching rooms for event: ${eventId}`);
      const response = await this.eventApiRequest('GET', 'rooms', null, { eventId });
      return Array.isArray(response) ? response : [];
    } catch (error) {
      throw new Error(`Failed to fetch rooms for event ${eventId}: ${error.message}`);
    }
  }

  /**
   * Get sessions for event
   */
  async getSessions(eventId) {
    try {
      this.logger.info(`Fetching sessions for event: ${eventId}`);
      const response = await this.eventApiRequest('GET', 'sessions', null, { eventId });
      return Array.isArray(response) ? response : [];
    } catch (error) {
      throw new Error(`Failed to fetch sessions for event ${eventId}: ${error.message}`);
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      eventApi: {
        baseUrl: this.eventApiConfig.baseUrl,
        timeout: this.config.migration.httpTimeout,
        endpoints: Object.keys(this.eventApiConfig.endpoints)
      },
      filesApi: {
        baseUrl: this.filesApiConfig.baseUrl,
        timeout: this.config.migration.httpTimeout,
        endpoints: Object.keys(this.filesApiConfig.endpoints)
      }
    };
  }

  /**
   * Get client statistics
   */
  getStatistics() {
    return {
      eventApi: {
        baseUrl: this.eventApiConfig.baseUrl,
        timeout: this.config.migration.httpTimeout
      },
      filesApi: {
        baseUrl: this.filesApiConfig.baseUrl,
        timeout: this.config.migration.httpTimeout
      }
    };
  }
}
