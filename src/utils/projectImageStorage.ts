// Project-based image storage that persists images as base64 data in project files
export interface StoredImage {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: Date;
  url: string; // Base64 data URL
  order: number;
}

interface StorageData {
  images: StoredImage[];
  version: number;
}

class ProjectImageStorage {
  private storageKey = 'quiz-display-images';
  private version = 1;

  async saveImage(file: File, order?: number): Promise<StoredImage> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const id = crypto.randomUUID();
          
          // If no order specified, get the next order number
          const finalOrder = order !== undefined ? order : await this.getNextOrder();
          
          const storedImage: StoredImage = {
            id,
            name: file.name,
            type: file.type,
            size: file.size,
            uploadDate: new Date(),
            url: base64,
            order: finalOrder
          };

          // Save to storage
          await this.addImageToStorage(storedImage);
          resolve(storedImage);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async getAllImages(): Promise<StoredImage[]> {
    try {
      const data = this.loadFromStorage();
      // Sort by order, then by upload date for consistent ordering
      return data.images.sort((a, b) => 
        a.order - b.order || new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
      );
    } catch (error) {
      console.error('Failed to load images:', error);
      return [];
    }
  }

  async deleteImage(id: string): Promise<void> {
    try {
      const data = this.loadFromStorage();
      data.images = data.images.filter(img => img.id !== id);
      this.saveToStorage(data);
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw error;
    }
  }

  async clearAllImages(): Promise<void> {
    try {
      const data: StorageData = {
        images: [],
        version: this.version
      };
      this.saveToStorage(data);
    } catch (error) {
      console.error('Failed to clear images:', error);
      throw error;
    }
  }

  async updateImageOrder(images: StoredImage[]): Promise<void> {
    try {
      const data = this.loadFromStorage();
      
      // Update order for each image
      images.forEach((image, index) => {
        const existingImage = data.images.find(img => img.id === image.id);
        if (existingImage) {
          existingImage.order = index;
        }
      });

      this.saveToStorage(data);
    } catch (error) {
      console.error('Failed to update image order:', error);
      throw error;
    }
  }

  async getNextOrder(): Promise<number> {
    const images = await this.getAllImages();
    return images.length > 0 ? Math.max(...images.map(img => img.order || 0)) + 1 : 0;
  }

  async getStorageInfo(): Promise<{ used: number; available: number; imageCount: number }> {
    try {
      const images = await this.getAllImages();
      const used = images.reduce((total, img) => total + img.size, 0);
      
      // Estimate available storage based on localStorage limits (typically 5-10MB)
      const storageString = JSON.stringify(this.loadFromStorage());
      const currentStorageSize = new Blob([storageString]).size;
      const maxStorage = 5 * 1024 * 1024; // 5MB estimate for localStorage
      const available = Math.max(0, maxStorage - currentStorageSize);

      return {
        used,
        available,
        imageCount: images.length
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { used: 0, available: 5 * 1024 * 1024, imageCount: 0 };
    }
  }

  async resetOrder(): Promise<void> {
    try {
      const images = await this.getAllImages();
      // Sort by upload date to get chronological order
      images.sort((a, b) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime());
      
      // Update order based on chronological order
      const orderedImages = images.map((img, index) => ({
        ...img,
        order: index
      }));

      await this.updateImageOrder(orderedImages);
    } catch (error) {
      console.error('Failed to reset order:', error);
      throw error;
    }
  }

  private async addImageToStorage(image: StoredImage): Promise<void> {
    try {
      const data = this.loadFromStorage();
      data.images.push(image);
      this.saveToStorage(data);
    } catch (error) {
      console.error('Failed to add image to storage:', error);
      throw error;
    }
  }

  private loadFromStorage(): StorageData {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return { images: [], version: this.version };
      }

      const data = JSON.parse(stored) as StorageData;
      
      // Convert date strings back to Date objects
      data.images = data.images.map(img => ({
        ...img,
        uploadDate: new Date(img.uploadDate)
      }));

      return data;
    } catch (error) {
      console.error('Failed to load from storage, returning empty data:', error);
      return { images: [], version: this.version };
    }
  }

  private saveToStorage(data: StorageData): void {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(this.storageKey, serialized);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new Error('Storage quota exceeded. Please delete some images to free up space.');
      }
      console.error('Failed to save to storage:', error);
      throw error;
    }
  }

  // Migration method to import from IndexedDB if needed
  async migrateFromIndexedDB(): Promise<boolean> {
    try {
      // Check if we have any localStorage data already
      const existing = this.loadFromStorage();
      if (existing.images.length > 0) {
        return false; // No migration needed
      }

      // Try to import from IndexedDB (the old storage)
      const indexedDBData = await this.importFromIndexedDB();
      if (indexedDBData.length > 0) {
        const data: StorageData = {
          images: indexedDBData,
          version: this.version
        };
        this.saveToStorage(data);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Migration from IndexedDB failed:', error);
      return false;
    }
  }

  private async importFromIndexedDB(): Promise<StoredImage[]> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('QuizDisplayImages', 2);
        
        request.onerror = () => {
          resolve([]);
        };
        
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('images')) {
            resolve([]);
            return;
          }

          const transaction = db.transaction(['images'], 'readonly');
          const store = transaction.objectStore('images');
          const getAllRequest = store.getAll();

          getAllRequest.onerror = () => resolve([]);
          getAllRequest.onsuccess = async () => {
            const indexedDBImages = getAllRequest.result;
            const convertedImages: StoredImage[] = [];

            for (const img of indexedDBImages) {
              try {
                // Convert blob to base64
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolveRead) => {
                  reader.onload = () => resolveRead(reader.result as string);
                  reader.onerror = () => resolveRead('');
                  reader.readAsDataURL(img.blob);
                });

                if (base64) {
                  convertedImages.push({
                    id: img.id,
                    name: img.name,
                    type: img.type,
                    size: img.size,
                    uploadDate: new Date(img.uploadDate),
                    url: base64,
                    order: img.order || 0
                  });
                }
              } catch (error) {
                console.error('Failed to convert image:', error);
              }
            }

            resolve(convertedImages);
          };
        };
      } catch (error) {
        resolve([]);
      }
    });
  }
}

// Export singleton instance
export const projectImageStorage = new ProjectImageStorage();

// Helper functions (same as before)
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  return validTypes.includes(file.type);
}

export function isValidImageSize(file: File, maxSizeBytes: number = 2 * 1024 * 1024): boolean {
  return file.size <= maxSizeBytes; // Reduced to 2MB for localStorage efficiency
}