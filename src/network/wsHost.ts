/**
 * WebSocket Host Networking Module
 *
 * This module broadcasts quiz state to player devices via WebSocket
 * by calling Electron IPC handlers. When running in Electron, it uses the IPC
 * API to communicate with the backend server which then broadcasts to all
 * connected players.
 *
 * When running in browser mode (dev), these calls are logged.
 */

export type NetworkMessageType =
  | 'PICTURE'
  | 'QUESTION_READY'
  | 'QUESTION'
  | 'TIMER_START'
  | 'TIMER'
  | 'TIMEUP'
  | 'LOCK'
  | 'REVEAL'
  | 'FASTEST'
  | 'SCORES'
  | 'NEXT'
  | 'END_ROUND'
  | 'ANSWER'  // incoming from players
  | 'PLAYER_JOIN'
  | 'PLAYER_DISCONNECT';

export interface NetworkPayload {
  type: NetworkMessageType;
  data?: any;
  timestamp?: number;
}

/**
 * Get the Electron IPC API, if available
 */
function getIpcApi() {
  return (window as any)?.api?.network;
}

/**
 * Check if we're running in Electron (IPC API available)
 */
function isElectron() {
  return !!getIpcApi();
}

/**
 * Host network class for broadcasting to players
 */
class HostNetwork {
  private enabled = false;
  private port = 8787;
  private listeners: Map<NetworkMessageType, Array<(data: any) => void>> = new Map();
  private networkPlayers: Map<string, { teamName: string; timestamp: number }> = new Map();

  /**
   * Initialize host network (called once on app start).
   */
  public init(options?: { enabled?: boolean; port?: number }) {
    if (options?.enabled !== undefined) this.enabled = options.enabled;
    if (options?.port) this.port = options.port;

    const electronAvailable = isElectron();
    console.log(
      `[HostNetwork] Initialized (port: ${this.port}, enabled: ${this.enabled}, electron: ${electronAvailable})`
    );
  }

  /**
   * Send a message to all connected players via IPC or fallback to local broadcast
   */
  private async sendToPlayers(messageType: string, data?: any) {
    const ipcApi = getIpcApi();

    if (ipcApi) {
      // Running in Electron - use IPC to send to backend
      try {
        switch (messageType) {
          case 'PICTURE':
            await ipcApi.sendPicture({ imageUrl: data?.image });
            break;
          case 'QUESTION_READY':
            await ipcApi.sendQuestionReady({
              options: data?.options,
              type: data?.type,
              maxAnswers: data?.maxAnswers,
            });
            break;
          case 'QUESTION':
            await ipcApi.sendQuestion({
              text: data?.text,
              options: data?.options,
              type: data?.type,
              maxAnswers: data?.maxAnswers,
            });
            break;
          case 'TIMER_START':
            await ipcApi.sendTimerStart({
              seconds: data?.seconds,
              silent: data?.silent,
            });
            break;
          case 'TIMER':
            await ipcApi.sendTimer({ seconds: data?.seconds });
            break;
          case 'TIMEUP':
            await ipcApi.sendTimeUp();
            break;
          case 'LOCK':
            // Lock is sent with TIMEUP in backend
            break;
          case 'REVEAL':
            await ipcApi.sendReveal({
              answer: data?.answer,
              correctIndex: data?.correctIndex,
              type: data?.type,
            });
            break;
          case 'ANSWER_CONFIRMED':
            await ipcApi.sendAnswerConfirmation({
              playerId: data?.playerId,
              teamName: data?.teamName,
            });
            break;
          case 'FASTEST':
            await ipcApi.sendFastest({
              teamName: data?.teamName,
              questionNumber: data?.questionNumber,
            });
            break;
          case 'NEXT':
            await ipcApi.sendNext();
            break;
          case 'END_ROUND':
            await ipcApi.sendEndRound();
            break;
          default:
            console.warn(`[HostNetwork] Unknown message type: ${messageType}`);
        }
      } catch (err) {
        console.error(`[HostNetwork] IPC send error for ${messageType}:`, err);
      }
    } else {
      // Browser mode - just log
      console.log(`[HostNetwork] ${messageType}:`, data);
    }
  }

  /**
   * Register a callback for incoming message type.
   * Used by external display and player devices to listen for updates.
   */
  public on(type: NetworkMessageType, callback: (data: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  /**
   * Trigger all registered listeners for a message type.
   */
  private triggerListeners(type: NetworkMessageType, data: any) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`[HostNetwork] Listener error for ${type}:`, e);
      }
    });
  }

  /**
   * Helper to send picture to players and external display.
   */
  public async sendPicture(imageDataUrl: string) {
    await this.sendToPlayers('PICTURE', { image: imageDataUrl });
  }

  /**
   * Helper to send question ready signal to players (before question text is shown).
   * This allows player apps to display the input interface while keeping the question hidden.
   */
  public async sendQuestionReady(options?: string[], type?: string, maxAnswers?: number) {
    await this.sendToPlayers('QUESTION_READY', { options, type, maxAnswers });
  }

  /**
   * Helper to send question to players and external display.
   */
  public async sendQuestion(text: string, options?: string[], type?: string, maxAnswers?: number) {
    await this.sendToPlayers('QUESTION', { text, options, type, maxAnswers });
  }

  /**
   * Helper to start timer on players and external display.
   */
  public async sendTimerStart(seconds: number, silent: boolean = false) {
    await this.sendToPlayers('TIMER_START', { seconds, silent });
    // Also send TIMER for external display countdown animation
    await this.sendToPlayers('TIMER', { seconds });
  }

  /**
   * Helper to signal time up (lock submissions).
   */
  public async sendTimeUp() {
    await this.sendToPlayers('TIMEUP', {});
    await this.sendToPlayers('LOCK', {});
  }

  /**
   * Helper to reveal the correct answer.
   */
  public async sendReveal(answer: string, correctIndex?: number, type?: string) {
    await this.sendToPlayers('REVEAL', { answer, correctIndex, type });
  }

  /**
   * Helper to confirm answer was received from player.
   */
  public async sendAnswerConfirmation(playerId: string, teamName: string) {
    await this.sendToPlayers('ANSWER_CONFIRMED', { playerId, teamName, timestamp: Date.now() });
  }

  /**
   * Helper to show fastest team.
   */
  public async sendFastest(teamName: string, questionNumber: number) {
    await this.sendToPlayers('FASTEST', { teamName, questionNumber });
  }

  /**
   * Helper to signal next question or end round.
   */
  public async sendNext() {
    await this.sendToPlayers('NEXT', {});
  }

  public async sendEndRound() {
    await this.sendToPlayers('END_ROUND', {});
  }

  /**
   * Helper to update scores on external display.
   */
  public async sendScores(scores: { teamId: string; teamName: string; score: number }[]) {
    // Scores are typically displayed on external display only, not sent to players
    console.log('[HostNetwork] Scores update:', scores);
  }

  /**
   * Register a player from the network.
   */
  public registerNetworkPlayer(playerId: string, teamName: string) {
    this.networkPlayers.set(playerId, { teamName, timestamp: Date.now() });
  }

  /**
   * Unregister a network player.
   */
  public unregisterNetworkPlayer(playerId: string) {
    this.networkPlayers.delete(playerId);
  }

  /**
   * Get all registered network players.
   */
  public getNetworkPlayers(): Array<{ id: string; teamName: string; timestamp: number }> {
    return Array.from(this.networkPlayers.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));
  }

  /**
   * Check if a player is registered.
   */
  public isPlayerRegistered(playerId: string): boolean {
    return this.networkPlayers.has(playerId);
  }
}

// Singleton instance
const hostNetwork = new HostNetwork();

export default hostNetwork;

/**
 * Convenience exports for common use cases in components.
 */
export function initHostNetwork(options?: { enabled?: boolean; port?: number }) {
  hostNetwork.init(options);
}

export async function sendPictureToPlayers(imageDataUrl: string) {
  return hostNetwork.sendPicture(imageDataUrl);
}

export async function sendQuestionReadyToPlayers(options?: string[], type?: string, maxAnswers?: number) {
  return hostNetwork.sendQuestionReady(options, type, maxAnswers);
}

export async function sendQuestionToPlayers(text: string, options?: string[], type?: string, maxAnswers?: number) {
  return hostNetwork.sendQuestion(text, options, type, maxAnswers);
}

export async function sendTimerToPlayers(seconds: number, silent: boolean = false) {
  return hostNetwork.sendTimerStart(seconds, silent);
}

export async function sendRevealToPlayers(answer: string, correctIndex?: number, type?: string) {
  return hostNetwork.sendReveal(answer, correctIndex, type);
}

export async function sendAnswerConfirmationToPlayer(playerId: string, teamName: string) {
  return hostNetwork.sendAnswerConfirmation(playerId, teamName);
}

export async function sendFastestToDisplay(teamName: string, questionNumber: number) {
  return hostNetwork.sendFastest(teamName, questionNumber);
}

export async function sendNextQuestion() {
  return hostNetwork.sendNext();
}

export async function sendEndRound() {
  return hostNetwork.sendEndRound();
}

export async function sendScoresToDisplay(scores: { teamId: string; teamName: string; score: number }[]) {
  return hostNetwork.sendScores(scores);
}

export function onNetworkMessage(
  type: NetworkMessageType,
  callback: (data: any) => void
) {
  hostNetwork.on(type, callback);
}

export function registerNetworkPlayer(playerId: string, teamName: string) {
  hostNetwork.registerNetworkPlayer(playerId, teamName);
}

export function unregisterNetworkPlayer(playerId: string) {
  hostNetwork.unregisterNetworkPlayer(playerId);
}

export function getNetworkPlayers() {
  return hostNetwork.getNetworkPlayers();
}

export function isPlayerRegistered(playerId: string): boolean {
  return hostNetwork.isPlayerRegistered(playerId);
}
