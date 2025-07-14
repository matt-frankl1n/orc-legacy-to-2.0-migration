import axios from 'axios';
import { ConfigManager } from '../config/ConfigManager.js';

/**
 * Legacy API Client - Handles all communication with the legacy Orchestrate system
 * Provides methods to fetch events, rooms, sessions, users, and files
 */
export class LegacyApiClient {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.baseUrl = config.legacy.baseUrl;
    this.endpoints = config.legacy.endpoints;
    
    // Create axios instance with default configuration
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: config.migration.httpTimeout,
      headers: ConfigManager.getAuthHeaders('legacy')
    });
    
    // Setup request/response interceptors
    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  setupInterceptors() {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        const startTime = Date.now();
        config.metadata = { startTime };
        
        this.logger.apiRequest(config.method?.toUpperCase(), config.url, config.data);
        return config;
      },
      (error) => {
        this.logger.apiError('REQUEST', error.config?.url, error, 0);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
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
        
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  /**
   * Handle API errors with proper error transformation
   */
  handleApiError(error) {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      const message = data?.message || data?.error || `HTTP ${status} error`;
      
      return new Error(`Legacy API Error (${status}): ${message}`);
    } else if (error.request) {
      // Request was made but no response received
      return new Error(`Legacy API Network Error: ${error.message}`);
    } else {
      // Something else happened
      return new Error(`Legacy API Error: ${error.message}`);
    }
  }

  /**
   * Generic GET request method
   */
  async get(endpointKey, params = {}) {
    try {
      let url = ConfigManager.buildEndpointUrl('legacy', endpointKey, params);
      
      // Add API key as query parameter for legacy API
      const urlObj = new URL(url);
      urlObj.searchParams.append('apiKey', this.config.legacy.apiKey);
      url = urlObj.toString();
      
      // Add event name header for legacy API
      const headers = {};
      if (params.eventName) {
        headers['x-eventName'] = params.eventName;
      }
      
      const response = await this.httpClient.get(url, { headers });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch ${endpointKey}:`, error);
      throw error;
    }
  }

  /**
   * Generic POST request method
   */
  async post(endpointKey, data, params = {}) {
    try {
      let url = ConfigManager.buildEndpointUrl('legacy', endpointKey, params);
      
      // Add API key as query parameter for legacy API
      const urlObj = new URL(url);
      urlObj.searchParams.append('apiKey', this.config.legacy.apiKey);
      url = urlObj.toString();
      
      // Add event name header for legacy API
      const headers = {};
      if (params.eventName) {
        headers['x-eventName'] = params.eventName;
      }
      
      const response = await this.httpClient.post(url, data, { headers });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to post to ${endpointKey}:`, error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      this.logger.info('Testing legacy API connection...');
      
      // Test with health endpoint first
      try {
        await this.httpClient.get('/health');
        this.logger.info('✅ Legacy API health check passed');
      } catch (error) {
        this.logger.warn('⚠️  Legacy API health endpoint failed, trying events...');
      }
      
      // Test events endpoint
      const url = `/v2/events?apiKey=${this.config.legacy.apiKey}`;
      const headers = { 'x-eventName': 'admin' };
      
      await this.httpClient.get(url, { headers });
      this.logger.info('✅ Legacy API connection test passed');
      
      return true;
    } catch (error) {
      this.logger.error('❌ Legacy API connection test failed:', error);
      throw new Error(`Legacy API connection failed: ${error.message}`);
    }
  }

  /**
   * Get event information
   */
  async getEvent(eventName) {
    try {
      this.logger.info(`Fetching event: ${eventName}`);
      
      const url = `/v2/events?apiKey=${this.config.legacy.apiKey}`;
      const headers = { 'x-eventName': eventName };
      
      const response = await this.httpClient.get(url, { headers });
      
      // Find the specific event in the response
      const events = response.data;
      const event = events.find(e => e.name === eventName);
      
      if (!event) {
        throw new Error(`Event '${eventName}' not found`);
      }
      
      return event;
    } catch (error) {
      this.logger.error(`Failed to fetch event ${eventName}:`, error);
      throw error;
    }
  }

  /**
   * Get rooms for an event
   */
  async getRooms(eventName) {
    try {
      this.logger.info(`Fetching rooms for event: ${eventName}`);
      return await this.get('rooms', { eventName });
    } catch (error) {
      this.logger.error(`Failed to fetch rooms for event ${eventName}:`, error);
      throw error;
    }
  }

  /**
   * Get specific room information
   */
  async getRoom(eventName, roomName) {
    try {
      this.logger.info(`Fetching room: ${roomName} for event: ${eventName}`);
      const rooms = await this.getRooms(eventName);
      
      const room = rooms.find(r => r.name === roomName);
      if (!room) {
        throw new Error(`Room '${roomName}' not found in event '${eventName}'`);
      }
      
      return room;
    } catch (error) {
      this.logger.error(`Failed to fetch room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Get sessions for an event/room
   */
  async getSessions(eventName, roomName = null) {
    try {
      this.logger.info(`Fetching sessions for event: ${eventName}${roomName ? `, room: ${roomName}` : ''}`);
      
      const sessions = await this.get('sessions', { eventName });
      
      // Filter by room if specified
      if (roomName) {
        return sessions.filter(session => session.roomName === roomName);
      }
      
      return sessions;
    } catch (error) {
      this.logger.error(`Failed to fetch sessions for event ${eventName}:`, error);
      throw error;
    }
  }

  /**
   * Get sub-sessions for an event/session
   */
  async getSubSessions(eventName, sessionId = null) {
    try {
      this.logger.info(`Fetching sub-sessions for event: ${eventName}${sessionId ? `, session: ${sessionId}` : ''}`);
      
      const subSessions = await this.get('subSessions', { eventName });
      
      // Filter by session if specified
      if (sessionId) {
        return subSessions.filter(subSession => subSession.sessionId === sessionId);
      }
      
      return subSessions;
    } catch (error) {
      this.logger.error(`Failed to fetch sub-sessions for event ${eventName}:`, error);
      throw error;
    }
  }

  /**
   * Get users for an event/room
   */
  async getUsers(eventName, roomName = null) {
    try {
      this.logger.info(`Fetching users for event: ${eventName}${roomName ? `, room: ${roomName}` : ''}`);
      
      const users = await this.get('users', { eventName });
      
      // Filter by room if specified
      if (roomName) {
        return users.filter(user => user.roomName === roomName);
      }
      
      return users;
    } catch (error) {
      this.logger.error(`Failed to fetch users for event ${eventName}:`, error);
      throw error;
    }
  }

  /**
   * Get moderators for an event/room
   */
  async getModerators(eventName, roomName = null) {
    try {
      this.logger.info(`Fetching moderators for event: ${eventName}${roomName ? `, room: ${roomName}` : ''}`);
      
      const moderators = await this.get('moderators', { eventName });
      
      // Filter by room if specified
      if (roomName) {
        return moderators.filter(moderator => moderator.roomName === roomName);
      }
      
      return moderators;
    } catch (error) {
      this.logger.error(`Failed to fetch moderators for event ${eventName}:`, error);
      throw error;
    }
  }

  /**
   * Get files for an event/room
   */
  async getFiles(eventName, roomName = null) {
    try {
      this.logger.info(`Fetching files for event: ${eventName}${roomName ? `, room: ${roomName}` : ''}`);
      
      let files;
      
      if (roomName) {
        // Get room-specific files
        files = await this.get('roomFiles', { eventName, roomName });
      } else {
        // Get all event files
        files = await this.get('files', { eventName });
      }
      
      return files;
    } catch (error) {
      this.logger.error(`Failed to fetch files for event ${eventName}:`, error);
      throw error;
    }
  }

  /**
   * Get session files
   */
  async getSessionFiles(eventName, sessionId) {
    try {
      this.logger.info(`Fetching session files for event: ${eventName}, session: ${sessionId}`);
      return await this.get('sessionFiles', { eventName, sessionId });
    } catch (error) {
      this.logger.error(`Failed to fetch session files for event ${eventName}, session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Download file from legacy system
   */
  async downloadFile(eventName, fileId, filePath) {
    try {
      this.logger.info(`Downloading file: ${fileId} from event: ${eventName}`);
      
      const url = `/v2/Events/${eventName}/Files/${fileId}/download?apiKey=${this.config.legacy.apiKey}`;
      const headers = { 'x-eventName': eventName };
      
      const response = await this.httpClient.get(url, { 
        headers,
        responseType: 'stream'
      });
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to download file ${fileId}:`, error);
      throw error;
    }
  }
}
