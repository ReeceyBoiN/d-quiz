// Audio storage utility for countdown timer sounds

export interface StoredAudio {
  id: string;
  name: string;
  url: string;
  type: 'countdown' | 'notification' | 'effect';
  duration?: number;
  uploadDate: Date;
}

class AudioStorage {
  private storageKey = 'quiz-audio-files';

  // Get all stored audio files
  async getAllAudio(): Promise<StoredAudio[]> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      return parsed.map((audio: any) => ({
        ...audio,
        uploadDate: new Date(audio.uploadDate)
      }));
    } catch (error) {
      console.error('Failed to load audio files:', error);
      return [];
    }
  }

  // Get audio by type
  async getAudioByType(type: StoredAudio['type']): Promise<StoredAudio[]> {
    const allAudio = await this.getAllAudio();
    return allAudio.filter(audio => audio.type === type);
  }

  // Store audio file
  async storeAudio(file: File, type: StoredAudio['type']): Promise<StoredAudio> {
    return new Promise((resolve, reject) => {
      // Validate file type
      if (!file.type.startsWith('audio/')) {
        reject(new Error('Please select a valid audio file'));
        return;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error('Audio file must be smaller than 10MB'));
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const audioData = e.target?.result as string;
          
          // Get audio duration
          const audio = new Audio(audioData);
          const duration = await this.getAudioDuration(audio);
          
          const storedAudio: StoredAudio = {
            id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            url: audioData,
            type,
            duration,
            uploadDate: new Date()
          };

          // Get existing audio files
          const existingAudio = await this.getAllAudio();
          
          // Add new audio
          const updatedAudio = [...existingAudio, storedAudio];
          
          // Save to localStorage
          localStorage.setItem(this.storageKey, JSON.stringify(updatedAudio));
          
          resolve(storedAudio);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read audio file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  // Get audio duration
  private getAudioDuration(audio: HTMLAudioElement): Promise<number> {
    return new Promise((resolve) => {
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      }, { once: true });

      audio.addEventListener('error', () => {
        resolve(0);
      }, { once: true });
    });
  }

  // Delete audio file
  async deleteAudio(audioId: string): Promise<void> {
    try {
      const existingAudio = await this.getAllAudio();
      const updatedAudio = existingAudio.filter(audio => audio.id !== audioId);
      
      localStorage.setItem(this.storageKey, JSON.stringify(updatedAudio));
    } catch (error) {
      console.error('Failed to delete audio:', error);
      throw error;
    }
  }

  // Clear all audio files
  async clearAllAudio(): Promise<void> {
    localStorage.removeItem(this.storageKey);
  }

  // Play audio for testing
  async playAudio(audioUrl: string, volume = 1): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      audio.volume = volume;

      audio.addEventListener('ended', () => resolve(), { once: true });
      audio.addEventListener('error', () => reject(new Error('Failed to play audio')), { once: true });

      audio.play().catch(reject);
    });
  }

  // Format duration for display
  formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

export const audioStorage = new AudioStorage();
