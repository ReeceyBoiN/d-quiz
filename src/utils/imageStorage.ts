// IndexedDB utility for persistent image storage
const DB_NAME = 'QuizDisplayImages';
const DB_VERSION = 2; // Increment version to handle order field migration
const STORE_NAME = 'images';

export interface StoredImage {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  uploadDate: Date;
  url: string; // Object URL for display
  order: number; // Order for display sequence
}

class ImageStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        this.db = request.result;
        // Migrate existing images to add order field
        await this.migrateExistingImages();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('uploadDate', 'uploadDate', { unique: false });
          store.createIndex('order', 'order', { unique: false });
        } else if (oldVersion < 2) {
          // Add order index for existing store
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const store = transaction.objectStore(STORE_NAME);
          if (!store.indexNames.contains('order')) {
            store.createIndex('order', 'order', { unique: false });
          }
        }
      };
    });
  }

  async saveImage(file: File, order?: number): Promise<StoredImage> {
    if (!this.db) await this.init();

    const id = crypto.randomUUID();
    const blob = new Blob([file], { type: file.type });
    const url = URL.createObjectURL(blob);
    
    // If no order specified, get the next order number
    const finalOrder = order !== undefined ? order : await this.getNextOrder();
    
    const storedImage: StoredImage = {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      blob,
      uploadDate: new Date(),
      url,
      order: finalOrder
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(storedImage);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(storedImage);
    });
  }

  async getAllImages(): Promise<StoredImage[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const images = request.result.map(img => ({
          ...img,
          url: URL.createObjectURL(img.blob), // Recreate object URLs
          order: img.order !== undefined ? img.order : 0 // Handle legacy images without order
        }));
        // Sort by order, then by upload date for consistent ordering
        images.sort((a, b) => a.order - b.order || new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime());
        resolve(images);
      };
    });
  }

  async deleteImage(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearAllImages(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async updateImageOrder(images: StoredImage[]): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      let completed = 0;
      const total = images.length;
      
      images.forEach((image, index) => {
        const updatedImage = { ...image, order: index };
        const request = store.put(updatedImage);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
      });
      
      if (total === 0) resolve();
    });
  }

  async getNextOrder(): Promise<number> {
    const images = await this.getAllImages();
    return images.length > 0 ? Math.max(...images.map(img => img.order || 0)) + 1 : 0;
  }

  private async migrateExistingImages(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const images = request.result;
        let needsMigration = false;
        
        // Check if any images need order assignment
        images.forEach((image, index) => {
          if (image.order === undefined || image.order === null) {
            image.order = index;
            needsMigration = true;
          }
        });

        if (needsMigration) {
          // Update images with order values
          let completed = 0;
          images.forEach(image => {
            const updateRequest = store.put(image);
            updateRequest.onsuccess = () => {
              completed++;
              if (completed === images.length) resolve();
            };
            updateRequest.onerror = () => reject(updateRequest.error);
          });
          
          if (images.length === 0) resolve();
        } else {
          resolve();
        }
      };
    });
  }

  async getStorageInfo(): Promise<{ used: number; available: number; imageCount: number }> {
    const images = await this.getAllImages();
    const used = images.reduce((total, img) => total + img.size, 0);
    
    // Estimate available storage (navigator.storage.estimate() if supported)
    let available = 50 * 1024 * 1024; // 50MB default estimate
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        available = (estimate.quota || 50 * 1024 * 1024) - (estimate.usage || 0);
      } catch (e) {
        // Fallback to default estimate
      }
    }

    return {
      used,
      available,
      imageCount: images.length
    };
  }
}

// Export singleton instance
export const imageStorage = new ImageStorage();

// Helper function to format file sizes
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to check if file is a valid image
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  return validTypes.includes(file.type);
}

// Helper function to validate image size
export function isValidImageSize(file: File, maxSizeBytes: number = 10 * 1024 * 1024): boolean {
  return file.size <= maxSizeBytes; // Default 10MB limit
}