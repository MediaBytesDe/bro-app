/**
 * Microsoft Graph / OneDrive Client
 * 
 * Handles file operations for BROjekt documents via OneDrive.
 * Uses Client Credentials flow (app-only, no user login required).
 * 
 * @see https://learn.microsoft.com/en-us/graph/api/resources/onedrive
 */

import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

// Types
export interface OneDriveItem {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  parentReference?: {
    driveId: string;
    id: string;
    path: string;
  };
}

export interface OneDriveUploadResult {
  id: string;
  name: string;
  webUrl: string;
  size: number;
}

export interface OneDriveSharingLink {
  id: string;
  webUrl: string;
  type: "view" | "edit";
}

// Folder structure for BROjekt
export const FOLDER_STRUCTURE = {
  ROOT: "BROjekt",
  PROJECTS: "Projekte",
  CUSTOMERS: "Kunden",
  TEMPLATES: "Vorlagen",
} as const;

/**
 * Get authenticated Microsoft Graph client
 */
function getGraphClient(): Client {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph credentials not configured");
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  return Client.initWithMiddleware({ authProvider });
}

/**
 * OneDrive Client class
 */
export class OneDriveClient {
  private client: Client;
  private driveId: string | null = null;

  constructor() {
    this.client = getGraphClient();
  }

  /**
   * Get the drive ID (uses the default drive of the app)
   */
  private async getDriveId(): Promise<string> {
    if (this.driveId) return this.driveId;

    // For app-only access, we need to specify which drive to use
    // This uses the organization's default SharePoint site drive
    // You may need to adjust this based on your setup
    const response = await this.client
      .api("/sites/root/drive")
      .get();
    
    this.driveId = response.id;
    return this.driveId;
  }

  /**
   * Ensure the BROjekt folder structure exists
   */
  async ensureFolderStructure(): Promise<void> {
    const driveId = await this.getDriveId();

    // Create root folder
    await this.createFolderIfNotExists(driveId, "root", FOLDER_STRUCTURE.ROOT);
    
    // Create subfolders
    const rootFolder = await this.getFolderByPath(`/${FOLDER_STRUCTURE.ROOT}`);
    if (rootFolder) {
      await this.createFolderIfNotExists(driveId, rootFolder.id, FOLDER_STRUCTURE.PROJECTS);
      await this.createFolderIfNotExists(driveId, rootFolder.id, FOLDER_STRUCTURE.CUSTOMERS);
      await this.createFolderIfNotExists(driveId, rootFolder.id, FOLDER_STRUCTURE.TEMPLATES);
    }
  }

  /**
   * Create a folder if it doesn't exist
   */
  private async createFolderIfNotExists(
    driveId: string,
    parentId: string,
    folderName: string
  ): Promise<OneDriveItem | null> {
    try {
      const response = await this.client
        .api(`/drives/${driveId}/items/${parentId}/children`)
        .post({
          name: folderName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "fail",
        });
      return response;
    } catch (err: unknown) {
      // Folder already exists - that's fine
      if ((err as { statusCode?: number }).statusCode === 409) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Get folder by path
   */
  async getFolderByPath(path: string): Promise<OneDriveItem | null> {
    const driveId = await this.getDriveId();
    
    try {
      const response = await this.client
        .api(`/drives/${driveId}/root:${path}`)
        .get();
      return response;
    } catch {
      return null;
    }
  }

  /**
   * Create project folder structure
   */
  async createProjectFolder(projectSlug: string, customerName?: string): Promise<string> {
    const driveId = await this.getDriveId();
    const projectPath = `/${FOLDER_STRUCTURE.ROOT}/${FOLDER_STRUCTURE.PROJECTS}`;
    
    // Get or create projects folder
    let projectsFolder = await this.getFolderByPath(projectPath);
    if (!projectsFolder) {
      await this.ensureFolderStructure();
      projectsFolder = await this.getFolderByPath(projectPath);
    }

    if (!projectsFolder) {
      throw new Error("Could not create projects folder");
    }

    // Create project folder
    const folderName = customerName 
      ? `${projectSlug} - ${customerName}`
      : projectSlug;

    const projectFolder = await this.client
      .api(`/drives/${driveId}/items/${projectsFolder.id}/children`)
      .post({
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename",
      });

    // Create subfolders for the project
    const subfolders = [
      "01_Aufmaß",
      "02_Planung",
      "03_Angebot",
      "04_Vertrag",
      "05_Dokumentation",
      "06_Rapporte",
      "07_Abnahme",
    ];

    for (const subfolder of subfolders) {
      await this.createFolderIfNotExists(driveId, projectFolder.id, subfolder);
    }

    return projectFolder.id;
  }

  /**
   * Upload a file
   */
  async uploadFile(
    folderId: string,
    fileName: string,
    content: Buffer | Blob | ArrayBuffer,
    contentType?: string
  ): Promise<OneDriveUploadResult> {
    const driveId = await this.getDriveId();

    // For files < 4MB, use simple upload
    const response = await this.client
      .api(`/drives/${driveId}/items/${folderId}:/${fileName}:/content`)
      .header("Content-Type", contentType || "application/octet-stream")
      .put(content);

    return {
      id: response.id,
      name: response.name,
      webUrl: response.webUrl,
      size: response.size,
    };
  }

  /**
   * Upload a large file (> 4MB) using upload session
   */
  async uploadLargeFile(
    folderId: string,
    fileName: string,
    content: Buffer,
    onProgress?: (progress: number) => void
  ): Promise<OneDriveUploadResult> {
    const driveId = await this.getDriveId();

    // Create upload session
    const session = await this.client
      .api(`/drives/${driveId}/items/${folderId}:/${fileName}:/createUploadSession`)
      .post({
        item: {
          "@microsoft.graph.conflictBehavior": "rename",
        },
      });

    const uploadUrl = session.uploadUrl;
    const fileSize = content.length;
    const chunkSize = 320 * 1024 * 10; // 3.2MB chunks

    let offset = 0;
    let response;

    while (offset < fileSize) {
      const chunk = content.slice(offset, Math.min(offset + chunkSize, fileSize));
      const chunkEnd = offset + chunk.length - 1;

      response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": chunk.length.toString(),
          "Content-Range": `bytes ${offset}-${chunkEnd}/${fileSize}`,
        },
        body: chunk,
      });

      if (!response.ok && response.status !== 202) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      offset += chunkSize;
      
      if (onProgress) {
        onProgress(Math.min(100, Math.round((offset / fileSize) * 100)));
      }
    }

    const result = await response!.json();
    
    return {
      id: result.id,
      name: result.name,
      webUrl: result.webUrl,
      size: result.size,
    };
  }

  /**
   * Download a file
   */
  async downloadFile(itemId: string): Promise<ArrayBuffer> {
    const driveId = await this.getDriveId();

    const response = await this.client
      .api(`/drives/${driveId}/items/${itemId}/content`)
      .get();

    return response;
  }

  /**
   * Get file metadata
   */
  async getFile(itemId: string): Promise<OneDriveItem> {
    const driveId = await this.getDriveId();

    return this.client
      .api(`/drives/${driveId}/items/${itemId}`)
      .get();
  }

  /**
   * List files in a folder
   */
  async listFiles(folderId: string): Promise<OneDriveItem[]> {
    const driveId = await this.getDriveId();

    const response = await this.client
      .api(`/drives/${driveId}/items/${folderId}/children`)
      .get();

    return response.value;
  }

  /**
   * Delete a file or folder
   */
  async deleteItem(itemId: string): Promise<void> {
    const driveId = await this.getDriveId();

    await this.client
      .api(`/drives/${driveId}/items/${itemId}`)
      .delete();
  }

  /**
   * Create a sharing link
   */
  async createSharingLink(
    itemId: string,
    type: "view" | "edit" = "view",
    expirationDays?: number
  ): Promise<OneDriveSharingLink> {
    const driveId = await this.getDriveId();

    const body: Record<string, unknown> = {
      type,
      scope: "anonymous",
    };

    if (expirationDays) {
      const expiration = new Date();
      expiration.setDate(expiration.getDate() + expirationDays);
      body.expirationDateTime = expiration.toISOString();
    }

    const response = await this.client
      .api(`/drives/${driveId}/items/${itemId}/createLink`)
      .post(body);

    return {
      id: response.id,
      webUrl: response.link.webUrl,
      type,
    };
  }

  /**
   * Search files
   */
  async searchFiles(query: string, folderId?: string): Promise<OneDriveItem[]> {
    const driveId = await this.getDriveId();

    const basePath = folderId
      ? `/drives/${driveId}/items/${folderId}`
      : `/drives/${driveId}/root`;

    const response = await this.client
      .api(`${basePath}/search(q='${encodeURIComponent(query)}')`)
      .get();

    return response.value;
  }
}

// Singleton instance
let clientInstance: OneDriveClient | null = null;

export function getOneDriveClient(): OneDriveClient {
  if (!clientInstance) {
    clientInstance = new OneDriveClient();
  }
  return clientInstance;
}
