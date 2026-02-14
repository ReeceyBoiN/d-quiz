/**
 * Utility for managing wheel type definitions
 * Wheel types define reusable sets of wheel items that can be saved and loaded
 */

export interface WheelTypeItem {
  id: string;
  label: string;
  value?: string;
}

export interface WheelTypeDefinition {
  id: string;
  name: string;
  description?: string;
  items: WheelTypeItem[];
  createdAt: number;
  version: number;
}

const STORAGE_KEY = 'wheelTypeDefinitions';

class WheelTypeStorage {
  /**
   * Load all wheel type definitions from localStorage
   */
  loadAll(): WheelTypeDefinition[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading wheel types:', error);
      return [];
    }
  }

  /**
   * Get a specific wheel type by ID
   */
  getById(id: string): WheelTypeDefinition | null {
    const types = this.loadAll();
    return types.find(type => type.id === id) || null;
  }

  /**
   * Create a new wheel type definition
   */
  create(name: string, items: WheelTypeItem[], description?: string): WheelTypeDefinition {
    const newType: WheelTypeDefinition = {
      id: `type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      items,
      createdAt: Date.now(),
      version: 1
    };

    const types = this.loadAll();
    types.push(newType);
    this.save(types);
    return newType;
  }

  /**
   * Update an existing wheel type
   */
  update(id: string, updates: Partial<Omit<WheelTypeDefinition, 'id' | 'createdAt' | 'version'>>): WheelTypeDefinition | null {
    const types = this.loadAll();
    const index = types.findIndex(type => type.id === id);
    
    if (index === -1) return null;

    types[index] = {
      ...types[index],
      ...updates
    };

    this.save(types);
    return types[index];
  }

  /**
   * Delete a wheel type by ID
   */
  delete(id: string): boolean {
    const types = this.loadAll();
    const filtered = types.filter(type => type.id !== id);
    
    if (filtered.length === types.length) return false; // Not found

    this.save(filtered);
    return true;
  }

  /**
   * Export a wheel type as JSON string
   */
  export(id: string): string | null {
    const type = this.getById(id);
    if (!type) return null;
    return JSON.stringify(type, null, 2);
  }

  /**
   * Export wheel type as downloadable file
   */
  downloadAsFile(id: string, filename?: string): void {
    const type = this.getById(id);
    if (!type) return;

    const jsonString = JSON.stringify(type, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `${type.name.toLowerCase().replace(/\s+/g, '-')}.wtype.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Import a wheel type from JSON string with validation
   */
  import(jsonString: string): WheelTypeDefinition | null {
    try {
      const parsed = JSON.parse(jsonString);
      
      // Validate required fields
      if (!parsed.name || !Array.isArray(parsed.items)) {
        throw new Error('Invalid wheel type: missing required fields');
      }

      // Validate items have required fields
      if (!parsed.items.every((item: any) => item.id && item.label)) {
        throw new Error('Invalid wheel type: items must have id and label');
      }

      // Check for duplicate IDs within the items
      const itemIds = new Set<string>();
      for (const item of parsed.items) {
        if (itemIds.has(item.id)) {
          throw new Error('Invalid wheel type: duplicate item IDs');
        }
        itemIds.add(item.id);
      }

      // Create new instance with fresh ID to avoid conflicts
      const newType = this.create(
        parsed.name,
        parsed.items,
        parsed.description
      );

      return newType;
    } catch (error) {
      console.error('Error importing wheel type:', error);
      return null;
    }
  }

  /**
   * Import wheel type from file
   */
  importFromFile(file: File): Promise<WheelTypeDefinition | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const imported = this.import(content);
        resolve(imported);
      };
      reader.onerror = () => {
        console.error('Error reading file');
        resolve(null);
      };
      reader.readAsText(file);
    });
  }

  /**
   * Private helper to save types to localStorage
   */
  private save(types: WheelTypeDefinition[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
    } catch (error) {
      console.error('Error saving wheel types:', error);
      if (error instanceof Error && error.message.includes('QuotaExceededError')) {
        alert('Storage quota exceeded. Please delete some wheel types.');
      }
    }
  }

  /**
   * Clear all wheel type definitions (for testing)
   */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const wheelTypeStorage = new WheelTypeStorage();
