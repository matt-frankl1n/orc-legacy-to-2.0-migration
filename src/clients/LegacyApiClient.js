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
      // Extract query parameters but leave URL parameters for the buildEndpointUrl
      const { search, showDeleted, ...urlParams } = params;
      
      let url = ConfigManager.buildEndpointUrl('legacy', endpointKey, urlParams);
      
      // Add API key and other query parameters
      const urlObj = new URL(url);
      urlObj.searchParams.append('apiKey', this.config.legacy.apiKey);
      
      // Add additional query parameters if provided
      if (search !== undefined) {
        urlObj.searchParams.append('search', search);
      }
      if (showDeleted !== undefined) {
        urlObj.searchParams.append('showDeleted', showDeleted);
      }
      
      url = urlObj.toString();
      
      // Add event name header for legacy API
      const headers = {};
      if (urlParams.eventName) {
        headers['x-eventName'] = urlParams.eventName;
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
      
      // Test with a simpler endpoint that should work with generic client token
      const url = `/v2/events?apiKey=${this.config.legacy.apiKey}`;
      
      await this.httpClient.get(url);
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
      const rooms = await this.get('rooms', { eventName });
      
      // Debug logging to see the actual data structure
      this.logger.info(`Received ${rooms?.length || 0} rooms from API`);
      if (rooms && rooms.length > 0) {
        console.log('First room structure:', JSON.stringify(rooms[0], null, 2));
        this.logger.info(`Room names: ${rooms.map(r => r.RoomName || r.name || r.roomName || r.Name || 'UNKNOWN').join(', ')}`);
      }
      
      return rooms;
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
      
      const room = rooms.find(r => r.RoomName === roomName || r.name === roomName);
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
  async getSessions(eventName, roomId = null) {
    try {
      this.logger.info(`Fetching sessions for event: ${eventName}${roomId ? `, room: ${roomId}` : ''}`);
      
      if (roomId) {
        // Use room-specific endpoint when room ID is provided
        const sessions = await this.get('roomSessions', { eventName, roomId });
        return sessions;
      } else {
        // Use general event sessions endpoint
        const sessions = await this.get('sessions', { eventName });
        return sessions;
      }
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
  async getUsers(eventName, roomId = null) {
    try {
      this.logger.info(`Fetching users for event: ${eventName}${roomId ? `, room: ${roomId}` : ''}`);
      
      // Use the correct eventUsers endpoint with required parameters
      const users = await this.get('eventUsers', { eventName, search: '', showDeleted: true });
      
      // Filter by room if specified
      if (roomId) {
        return users.filter(user => user.roomId === roomId);
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
      
      let files = [];
      
      try {
        if (roomName) {
          // Try room-specific files first
          files = await this.get('roomFiles', { eventName, roomName });
        } else {
          // Try general event files
          files = await this.get('files', { eventName });
        }
      } catch (error) {
        // If 405 Method Not Allowed, try alternative endpoints
        if (error.message.includes('405')) {
          this.logger.warn(`File endpoint not available (405), trying alternative approach...`);
          
          // Try to get files from sessions instead
          try {
            const sessions = await this.getSessions(eventName);
            const sessionFiles = [];
            
            for (const session of sessions) {
              // Check if session has WalkInFile
              if (session.WalkInFile && !session.WalkInFile.IsDeleted) {
                sessionFiles.push({
                  ...session.WalkInFile,
                  fileType: 'walkin',
                  sessionId: session.SessionId,
                  sessionName: session.SessionName
                });
              }
              
              // Check if session has presentation files in subsessions
              if (session.SubSessions) {
                for (const subSession of session.SubSessions) {
                  if (subSession.PresentationFiles && subSession.PresentationFiles.length > 0) {
                    sessionFiles.push(...subSession.PresentationFiles.map(file => ({
                      ...file,
                      fileType: 'presentation',
                      sessionId: session.SessionId,
                      subSessionId: subSession.SubSessionId,
                      sessionName: session.SessionName,
                      subSessionName: subSession.SubSessionName
                    })));
                  }
                }
              }
            }
            
            files = sessionFiles;
            this.logger.info(`✅ Retrieved ${files.length} files from session data`);
          } catch (sessionError) {
            this.logger.warn(`Could not retrieve files from sessions: ${sessionError.message}`);
            files = [];
          }
        } else {
          throw error;
        }
      }
      
      return files;
    } catch (error) {
      this.logger.error(`Failed to fetch files for event ${eventName}:`, error);
      // Return empty array instead of throwing to allow migration to continue
      return [];
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
  async downloadFile(eventName, fileId, filePath, subSessionId = null) {
    try {
      // Validate required parameters
      if (!eventName || !fileId) {
        throw new Error(`Missing required parameters: eventName=${eventName}, fileId=${fileId}`);
      }
      
      this.logger.info(`Downloading file: ${fileId} from event: ${eventName}${subSessionId ? `, subsession: ${subSessionId}` : ''}`);
      
      // Use the original download endpoint pattern
      const url = `/v2/Events/${eventName}/Files/${fileId}/download?apiKey=${this.config.legacy.apiKey}`;
      const headers = { 
        'x-eventName': eventName,
        'x-isAdmin': false
      };
      
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
