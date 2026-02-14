/**
 * Utility for managing wheel instance presets
 * Presets save specific wheel configurations (type, items, settings) for quick loading
 */

import { WheelTypeItem } from './wheelTypeStorage';

export type WheelContentType = 'teams' | 'random-points' | 'custom';

export interface WheelPreset {
  id: string;
  name: string;
  wheelTypeId?: string;                   // Reference to custom wheel type (if applicable)
  contentType: WheelContentType;
  customItems?: WheelTypeItem[];          // Custom items for 'custom' content type
  customPointValues?: number[];           // Point values for 'random-points' type
  removedItems?: string[];                // Items removed during wheel sessions (will be cleared on load)
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'wheelPresets';

class WheelPresetStorage {
  /**
   * Load all presets from localStorage
   */
  loadAll(): WheelPreset[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading wheel presets:', error);
      return [];
    }
  }

  /**
   * Get a specific preset by ID
   */
  getById(id: string): WheelPreset | null {
    const presets = this.loadAll();
    return presets.find(preset => preset.id === id) || null;
  }

  /**
   * Get all presets for a specific content type
   */
  getByContentType(contentType: WheelContentType): WheelPreset[] {
    const presets = this.loadAll();
    return presets.filter(preset => preset.contentType === contentType);
  }

  /**
   * Create a new preset
   */
  create(
    name: string,
    contentType: WheelContentType,
    options: {
      wheelTypeId?: string;
      customItems?: WheelTypeItem[];
      customPointValues?: number[];
    } = {}
  ): WheelPreset {
    const newPreset: WheelPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      contentType,
      wheelTypeId: options.wheelTypeId,
      customItems: options.customItems,
      customPointValues: options.customPointValues,
      removedItems: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const presets = this.loadAll();
    presets.push(newPreset);
    this.save(presets);
    return newPreset;
  }

  /**
   * Update an existing preset
   */
  update(
    id: string,
    updates: Partial<Omit<WheelPreset, 'id' | 'createdAt'>>
  ): WheelPreset | null {
    const presets = this.loadAll();
    const index = presets.findIndex(preset => preset.id === id);
    
    if (index === -1) return null;

    presets[index] = {
      ...presets[index],
      ...updates,
      updatedAt: Date.now()
    };

    this.save(presets);
    return presets[index];
  }

  /**
   * Delete a preset by ID
   */
  delete(id: string): boolean {
    const presets = this.loadAll();
    const filtered = presets.filter(preset => preset.id !== id);
    
    if (filtered.length === presets.length) return false; // Not found

    this.save(filtered);
    return true;
  }

  /**
   * Delete all presets
   */
  deleteAll(): void {
    this.save([]);
  }

  /**
   * Export a preset as JSON string
   */
  export(id: string): string | null {
    const preset = this.getById(id);
    if (!preset) return null;
    return JSON.stringify(preset, null, 2);
  }

  /**
   * Export preset as downloadable file
   */
  downloadAsFile(id: string, filename?: string): void {
    const preset = this.getById(id);
    if (!preset) return;

    const jsonString = JSON.stringify(preset, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `${preset.name.toLowerCase().replace(/\s+/g, '-')}.wpreset.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Import a preset from JSON string with validation
   */
  import(jsonString: string): WheelPreset | null {
    try {
      const parsed = JSON.parse(jsonString);
      
      // Validate required fields
      if (!parsed.name || !parsed.contentType) {
        throw new Error('Invalid preset: missing required fields');
      }

      // Create new instance with fresh ID to avoid conflicts
      const newPreset = this.create(parsed.name, parsed.contentType, {
        wheelTypeId: parsed.wheelTypeId,
        customItems: parsed.customItems,
        customPointValues: parsed.customPointValues
      });

      return newPreset;
    } catch (error) {
      console.error('Error importing preset:', error);
      return null;
    }
  }

  /**
   * Import preset from file
   */
  importFromFile(file: File): Promise<WheelPreset | null> {
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
   * Private helper to save presets to localStorage
   */
  private save(presets: WheelPreset[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (error) {
      console.error('Error saving wheel presets:', error);
      if (error instanceof Error && error.message.includes('QuotaExceededError')) {
        alert('Storage quota exceeded. Please delete some presets.');
      }
    }
  }

  /**
   * Clear all presets (for testing)
   */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const wheelPresetStorage = new WheelPresetStorage();
