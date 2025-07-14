import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

/**
 * File Service - Handles file operations for migration
 * Downloads files from legacy system and uploads to current system
 */
export class FileService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.tempDir = tmpdir();
    
    // File processing statistics
    this.statistics = {
      filesProcessed: 0,
      filesUploaded: 0,
      filesFailed: 0,
      totalBytesProcessed: 0,
      totalBytesUploaded: 0,
      averageUploadSpeed: 0,
      uploadTimes: []
    };
  }

  /**
   * Process and upload a file from legacy system to current system
   */
  async uploadFile(fileStream, fileMetadata, progressCallback = null) {
    const startTime = Date.now();
    
    try {
      this.logger.fileOperation('uploading', fileMetadata.originalFileName);
      
      // Generate temporary file path
      const tempFileName = this.generateTempFileName(fileMetadata.originalFileName);
      const tempFilePath = join(this.tempDir, tempFileName);
      
      // Save stream to temporary file
      await this.saveStreamToFile(fileStream, tempFilePath, progressCallback);
      
      // Get file stats
      const fileStats = await this.getFileStats(tempFilePath);
      fileMetadata.fileSizeBytes = fileStats.size;
      
      // Upload to current system
      const uploadResult = await this.uploadToCurrentSystem(tempFilePath, fileMetadata);
      
      // Clean up temporary file
      await this.cleanupTempFile(tempFilePath);
      
      // Update statistics
      const uploadTime = Date.now() - startTime;
      this.updateStatistics(fileMetadata.fileSizeBytes, uploadTime, true);
      
      this.logger.fileOperation('uploaded', fileMetadata.originalFileName, fileMetadata.fileSizeBytes);
      
      return uploadResult;
      
    } catch (error) {
      this.logger.fileError('uploading', fileMetadata.originalFileName, error);
      this.updateStatistics(0, Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Download file from legacy system
   */
  async downloadFile(fileUrl, fileName, progressCallback = null) {
    const startTime = Date.now();
    
    try {
      this.logger.fileOperation('downloading', fileName);
      
      // Create HTTP client for file download
      const response = await this.createDownloadStream(fileUrl);
      
      // Generate temporary file path
      const tempFileName = this.generateTempFileName(fileName);
      const tempFilePath = join(this.tempDir, tempFileName);
      
      // Download to temporary file
      await this.saveStreamToFile(response, tempFilePath, progressCallback);
      
      // Get file stats
      const fileStats = await this.getFileStats(tempFilePath);
      
      const downloadTime = Date.now() - startTime;
      this.logger.fileOperation('downloaded', fileName, fileStats.size);
      
      return {
        tempFilePath: tempFilePath,
        fileName: fileName,
        fileSize: fileStats.size,
        downloadTime: downloadTime
      };
      
    } catch (error) {
      this.logger.fileError('downloading', fileName, error);
      throw error;
    }
  }

  /**
   * Create download stream from URL
   */
  async createDownloadStream(fileUrl) {
    const axios = await import('axios');
    
    try {
      const response = await axios.default.get(fileUrl, {
        responseType: 'stream',
        timeout: this.config.migration.fileDownloadTimeout || 180000,
        headers: {
          'User-Agent': 'Legacy-Migration-Tool/1.0'
        }
      });
      
      return response.data;
      
    } catch (error) {
      throw new Error(`Failed to create download stream: ${error.message}`);
    }
  }

  /**
   * Save stream to file with progress tracking
   */
  async saveStreamToFile(stream, filePath, progressCallback = null) {
    try {
      const writeStream = createWriteStream(filePath);
      let bytesWritten = 0;
      
      // Track progress if callback provided
      if (progressCallback) {
        stream.on('data', (chunk) => {
          bytesWritten += chunk.length;
          progressCallback(bytesWritten);
        });
      }
      
      // Use pipeline for proper error handling
      await pipeline(stream, writeStream);
      
      this.logger.debug(`File saved to: ${filePath} (${bytesWritten} bytes)`);
      
    } catch (error) {
      throw new Error(`Failed to save stream to file: ${error.message}`);
    }
  }

  /**
   * Upload file to current system
   */
  async uploadToCurrentSystem(filePath, fileMetadata) {
    try {
      const FormData = await import('form-data');
      const axios = await import('axios');
      
      // Create form data
      const formData = new FormData.default();
      
      // Add file
      const fileStream = createReadStream(filePath);
      formData.append('file', fileStream, {
        filename: fileMetadata.originalFileName,
        contentType: fileMetadata.mimeType
      });
      
      // Add metadata
      Object.entries(fileMetadata).forEach(([key, value]) => {
        if (key !== 'originalFileName' && value !== null && value !== undefined) {
          formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        }
      });
      
      // Determine upload endpoint based on file type
      const uploadUrl = this.getUploadUrl(fileMetadata);
      
      // Upload file
      const response = await axios.default.post(uploadUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.config.current.bearerToken}`
        },
        timeout: this.config.migration.fileUploadTimeout || 300000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      return response.data;
      
    } catch (error) {
      throw new Error(`Failed to upload to current system: ${error.message}`);
    }
  }

  /**
   * Get upload URL based on file metadata
   */
  getUploadUrl(fileMetadata) {
    const { ConfigManager } = require('../config/ConfigManager.js');
    
    // Determine file type and get appropriate endpoint
    if (fileMetadata.sessionId) {
      return ConfigManager.buildEndpointUrl('current-files', 'sessionFiles');
    } else if (fileMetadata.subSessionId) {
      return ConfigManager.buildEndpointUrl('current-files', 'subSessionFiles');
    } else if (fileMetadata.userId) {
      return ConfigManager.buildEndpointUrl('current-files', 'userFiles');
    } else if (fileMetadata.moderatorId) {
      return ConfigManager.buildEndpointUrl('current-files', 'moderatorFiles');
    } else {
      // Default to general upload endpoint
      return ConfigManager.buildEndpointUrl('current-files', 'upload');
    }
  }

  /**
   * Get file statistics
   */
  async getFileStats(filePath) {
    const fs = await import('fs/promises');
    
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      throw new Error(`Failed to get file stats: ${error.message}`);
    }
  }

  /**
   * Generate temporary file name
   */
  generateTempFileName(originalFileName) {
    const randomSuffix = randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const extension = originalFileName.split('.').pop();
    
    return `migration_${timestamp}_${randomSuffix}.${extension}`;
  }

  /**
   * Clean up temporary file
   */
  async cleanupTempFile(filePath) {
    try {
      const fs = await import('fs/promises');
      await fs.unlink(filePath);
      this.logger.debug(`Cleaned up temporary file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup temporary file: ${filePath}`, error);
    }
  }

  /**
   * Update file processing statistics
   */
  updateStatistics(bytesProcessed, uploadTime, success) {
    this.statistics.filesProcessed++;
    
    if (success) {
      this.statistics.filesUploaded++;
      this.statistics.totalBytesUploaded += bytesProcessed;
      this.statistics.uploadTimes.push(uploadTime);
      
      // Calculate average upload speed (bytes per second)
      const avgUploadTime = this.statistics.uploadTimes.reduce((sum, time) => sum + time, 0) / this.statistics.uploadTimes.length;
      this.statistics.averageUploadSpeed = this.statistics.totalBytesUploaded / (avgUploadTime / 1000);
    } else {
      this.statistics.filesFailed++;
    }
    
    this.statistics.totalBytesProcessed += bytesProcessed;
  }

  /**
   * Process multiple files in parallel
   */
  async processFiles(files, processingFunction, concurrency = 3) {
    const pLimit = await import('p-limit');
    const limit = pLimit.default(concurrency);
    
    this.logger.info(`Processing ${files.length} files with concurrency: ${concurrency}`);
    
    const results = await Promise.allSettled(
      files.map(file => 
        limit(async () => {
          try {
            return await processingFunction(file);
          } catch (error) {
            this.logger.fileError('processing', file.fileName || 'unknown', error);
            throw error;
          }
        })
      )
    );
    
    // Process results
    const successful = results.filter(result => result.status === 'fulfilled');
    const failed = results.filter(result => result.status === 'rejected');
    
    this.logger.info(`File processing completed: ${successful.length} successful, ${failed.length} failed`);
    
    return {
      successful: successful.map(result => result.value),
      failed: failed.map(result => result.reason),
      total: files.length
    };
  }

  /**
   * Validate file before processing
   */
  async validateFile(filePath, expectedSize = null, expectedMimeType = null) {
    try {
      const stats = await this.getFileStats(filePath);
      
      // Check if file exists and is actually a file
      if (!stats.isFile) {
        throw new Error('Path is not a file');
      }
      
      // Check file size if provided
      if (expectedSize && stats.size !== expectedSize) {
        throw new Error(`File size mismatch: expected ${expectedSize}, got ${stats.size}`);
      }
      
      // Check MIME type if provided
      if (expectedMimeType) {
        const actualMimeType = await this.getMimeType(filePath);
        if (actualMimeType !== expectedMimeType) {
          this.logger.warn(`MIME type mismatch: expected ${expectedMimeType}, got ${actualMimeType}`);
        }
      }
      
      return true;
      
    } catch (error) {
      throw new Error(`File validation failed: ${error.message}`);
    }
  }

  /**
   * Get MIME type of file
   */
  async getMimeType(filePath) {
    try {
      const { fileTypeFromFile } = await import('file-type');
      const fileType = await fileTypeFromFile(filePath);
      return fileType?.mime || 'application/octet-stream';
    } catch (error) {
      this.logger.warn(`Failed to detect MIME type for ${filePath}:`, error);
      return 'application/octet-stream';
    }
  }

  /**
   * Calculate file hash for integrity checking
   */
  async calculateFileHash(filePath, algorithm = 'sha256') {
    try {
      const crypto = await import('crypto');
      const fs = await import('fs');
      
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);
      
      await pipeline(stream, hash);
      return hash.digest('hex');
      
    } catch (error) {
      throw new Error(`Failed to calculate file hash: ${error.message}`);
    }
  }

  /**
   * Get file processing statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      successRate: this.statistics.filesProcessed > 0 
        ? Math.round((this.statistics.filesUploaded / this.statistics.filesProcessed) * 100) 
        : 0,
      averageUploadSpeedMBps: this.statistics.averageUploadSpeed / (1024 * 1024),
      totalBytesProcessedMB: this.statistics.totalBytesProcessed / (1024 * 1024),
      totalBytesUploadedMB: this.statistics.totalBytesUploaded / (1024 * 1024)
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.statistics = {
      filesProcessed: 0,
      filesUploaded: 0,
      filesFailed: 0,
      totalBytesProcessed: 0,
      totalBytesUploaded: 0,
      averageUploadSpeed: 0,
      uploadTimes: []
    };
  }

  /**
   * Clean up all temporary files
   */
  async cleanupAllTempFiles() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Find all migration temp files
      const tempFiles = await fs.readdir(this.tempDir);
      const migrationFiles = tempFiles.filter(file => file.startsWith('migration_'));
      
      // Delete each file
      for (const file of migrationFiles) {
        const filePath = path.join(this.tempDir, file);
        try {
          await fs.unlink(filePath);
          this.logger.debug(`Cleaned up temp file: ${file}`);
        } catch (error) {
          this.logger.warn(`Failed to cleanup temp file: ${file}`, error);
        }
      }
      
      this.logger.info(`Cleaned up ${migrationFiles.length} temporary files`);
      
    } catch (error) {
      this.logger.error('Failed to cleanup temporary files:', error);
    }
  }
}
