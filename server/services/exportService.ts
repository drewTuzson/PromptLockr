import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db.js';
import { prompts, folders, templates, exportJobs } from '@shared/schema';
import type { Prompt, Folder, Template } from '@shared/schema';

interface ExportData {
  prompts: Prompt[];
  folders: Folder[];
  templates?: Template[];
  metadata: {
    exportedAt: string;
    version: string;
    totalItems: number;
  };
}

export class ExportService {
  /**
   * Process export job for a user in specified format
   */
  static async processExportJob(
    userId: string, 
    format: 'json' | 'csv' | 'markdown',
    includeTemplates: boolean = false
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      // Fetch user data
      const exportData = await this.gatherUserData(userId, includeTemplates);
      
      // Process based on format
      let processedData: string;
      
      switch (format) {
        case 'json':
          processedData = this.exportToJSON(exportData);
          break;
        case 'csv':
          processedData = this.exportToCSV(exportData);
          break;
        case 'markdown':
          processedData = this.exportToMarkdown(exportData);
          break;
        default:
          return { success: false, error: 'Unsupported export format' };
      }

      return { success: true, data: processedData };
    } catch (error) {
      console.error('Export processing error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown export error' 
      };
    }
  }

  /**
   * Gather all user data for export
   */
  private static async gatherUserData(userId: string, includeTemplates: boolean): Promise<ExportData> {
    // Fetch prompts (non-trashed)
    const userPrompts = await db
      .select()
      .from(prompts)
      .where(and(
        eq(prompts.userId, userId),
        isNull(prompts.trashedAt)
      ))
      .orderBy(prompts.createdAt);

    // Fetch folders
    const userFolders = await db
      .select()
      .from(folders)
      .where(eq(folders.userId, userId))
      .orderBy(folders.createdAt);

    // Fetch templates if requested
    let userTemplates: Template[] = [];
    if (includeTemplates) {
      userTemplates = await db
        .select()
        .from(templates)
        .where(eq(templates.userId, userId))
        .orderBy(templates.createdAt);
    }

    return {
      prompts: userPrompts,
      folders: userFolders,
      templates: includeTemplates ? userTemplates : undefined,
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        totalItems: userPrompts.length + userFolders.length + userTemplates.length
      }
    };
  }

  /**
   * Export data to JSON format
   */
  private static exportToJSON(data: ExportData): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export data to CSV format
   */
  private static exportToCSV(data: ExportData): string {
    const csvRows: string[] = [];
    
    // Header
    csvRows.push('Type,ID,Title,Content,Platform,Tags,Folder,Created,LastAccessed,IsFavorite');
    
    // Add prompts
    for (const prompt of data.prompts) {
      const row = [
        'prompt',
        prompt.id,
        this.escapeCsvValue(prompt.title),
        this.escapeCsvValue(prompt.content),
        prompt.platform,
        (prompt.tags || []).join(';'),
        prompt.folderId || '',
        prompt.createdAt ? new Date(prompt.createdAt).toISOString() : '',
        prompt.lastAccessed ? new Date(prompt.lastAccessed).toISOString() : '',
        prompt.isFavorite ? 'true' : 'false'
      ];
      csvRows.push(row.join(','));
    }

    // Add folders
    for (const folder of data.folders) {
      const row = [
        'folder',
        folder.id,
        this.escapeCsvValue(folder.name),
        '', // content
        '', // platform
        '', // tags
        folder.parentId || '',
        folder.createdAt,
        '', // lastAccessed
        'false' // isFavorite
      ];
      csvRows.push(row.join(','));
    }

    // Add templates if included
    if (data.templates) {
      for (const template of data.templates) {
        const row = [
          'template',
          template.id,
          this.escapeCsvValue(template.title),
          this.escapeCsvValue(template.content),
          '', // platform
          (template.tags || []).join(';'),
          '', // folder
          template.createdAt,
          '', // lastAccessed
          'false' // isFavorite
        ];
        csvRows.push(row.join(','));
      }
    }

    return csvRows.join('\n');
  }

  /**
   * Export data to Markdown format
   */
  private static exportToMarkdown(data: ExportData): string {
    const md: string[] = [];
    
    // Header
    md.push('# PromptLockr Export');
    md.push(`Exported on: ${new Date(data.metadata.exportedAt).toLocaleString()}`);
    md.push(`Total items: ${data.metadata.totalItems}`);
    md.push('\n---\n');

    // Folders section
    if (data.folders.length > 0) {
      md.push('## 📁 Folders\n');
      for (const folder of data.folders) {
        md.push(`### ${folder.name}`);
        md.push(`- **ID:** ${folder.id}`);
        md.push(`- **Parent:** ${folder.parentId || 'Root'}`);
        md.push(`- **Created:** ${folder.createdAt ? new Date(folder.createdAt).toLocaleString() : 'Unknown'}\n`);
      }
      md.push('\n---\n');
    }

    // Prompts section
    if (data.prompts.length > 0) {
      md.push('## ⚡ Prompts\n');
      for (const prompt of data.prompts) {
        md.push(`### ${prompt.title}`);
        md.push(`- **Platform:** ${prompt.platform}`);
        md.push(`- **Tags:** ${(prompt.tags || []).join(', ') || 'None'}`);
        md.push(`- **Folder:** ${prompt.folderId || 'Root'}`);
        md.push(`- **Favorite:** ${prompt.isFavorite ? '⭐ Yes' : 'No'}`);
        md.push(`- **Created:** ${prompt.createdAt ? new Date(prompt.createdAt).toLocaleString() : 'Unknown'}`);        
        md.push(`- **Last Accessed:** ${prompt.lastAccessed ? new Date(prompt.lastAccessed).toLocaleString() : 'Unknown'}`);        
        md.push('\n**Content:**');
        md.push('```');
        md.push(prompt.content);
        md.push('```\n');
      }
      md.push('\n---\n');
    }

    // Templates section
    if (data.templates && data.templates.length > 0) {
      md.push('## 🎯 Templates\n');
      for (const template of data.templates) {
        md.push(`### ${template.title}`);        
        md.push(`- **Tags:** ${(template.tags || []).join(', ') || 'None'}`);        
        md.push(`- **Created:** ${template.createdAt ? new Date(template.createdAt).toLocaleString() : 'Unknown'}`);        
        if (template.description) {
          md.push(`- **Description:** ${template.description}`);
        }
        md.push('\n**Content:**');
        md.push('```');
        md.push(template.content);
        md.push('```\n');
      }
    }

    return md.join('\n');
  }

  /**
   * Escape CSV values to handle commas, quotes, and newlines
   */
  private static escapeCsvValue(value: string): string {
    if (!value) return '';
    
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    
    return value;
  }

  /**
   * Calculate estimated export file size
   */
  static estimateExportSize(
    promptCount: number, 
    folderCount: number, 
    avgPromptSize: number = 500,
    format: 'json' | 'csv' | 'markdown' = 'json'
  ): { bytes: number; readable: string } {
    let baseSize = (promptCount * avgPromptSize) + (folderCount * 100);
    
    // Format multipliers
    const formatMultipliers = {
      json: 1.3, // JSON overhead
      csv: 0.8,  // CSV is more compact
      markdown: 1.6 // Markdown has more formatting
    };
    
    const estimatedBytes = Math.ceil(baseSize * formatMultipliers[format]);
    
    return {
      bytes: estimatedBytes,
      readable: this.formatFileSize(estimatedBytes)
    };
  }

  /**
   * Format file size in human readable format
   */
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}