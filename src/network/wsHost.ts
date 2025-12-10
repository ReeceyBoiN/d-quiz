/**
 * WebSocket Host Networking Scaffold
 * 
 * This module provides a simple networking layer for broadcasting
 * quiz state to player devices and external displays via WebSocket.
 * 
 * Later, when the player phone app is built, it will connect to this
 * server via: new WebSocket('ws://host-ip:8787')
 * 
 * For now, this is set up as a foundation for future integration.
 */

export type NetworkMessageType =
  | 'PICTURE'
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
 * Host network state for managing broadcast connections.
 * This will eventually connect to a WebSocket server for LAN communication.
 */
class HostNetwork {
  private enabled = false;
  private port = 8787;
  private listeners: Map<NetworkMessageType, Array<(data: any) => void>> = new Map();
  private networkPlayers: Map<string, { teamName: string; timestamp: number }> = new Map();

  /**
   * Initialize host network (called once on app start).
   * Currently a placeholder; will create ws.WebSocketServer in Electron main when ready.
   */
  public init(options?: { enabled?: boolean; port?: number }) {
    if (options?.enabled !== undefined) this.enabled = options.enabled;
    if (options?.port) this.port = options.port;
    
    console.log(
      `[HostNetwork] Initialized (port: ${this.port}, enabled: ${this.enabled})`
    );
    // TODO: Start WebSocketServer on Electron main process or in dev via Node.js
    // For now, this is a foundation for broadcasting via other means (IPC, etc.)
  }

  /**
   * Broadcast a message to all connected players and displays.
   * Currently logs; will send over WebSocket when server is active.
   */
  public broadcast(payload: NetworkPayload) {
    if (!this.enabled) {
      console.log('[HostNetwork] Broadcast (disabled):', payload);
      return;
    }

    const msg = { ...payload, timestamp: Date.now() };
    console.log('[HostNetwork] Broadcasting:', msg);

    // TODO: When ws server is live, iterate clients and ws.send(JSON.stringify(msg))
    // For now, you can use this to trigger local callbacks (see .on() below)
    this.triggerListeners(payload.type, payload.data);
  }

  /**
   * Register a callback for incoming message type.
   * Used by external display and player devices to listen for updates.
   * Returns an unsubscribe function to clean up the listener.
   */
  public on(type: NetworkMessageType, callback: (data: any) => void): (() => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);

    // Return an unsubscribe function
    return () => {
      this.off(type, callback);
    };
  }

  /**
   * Unregister a callback for a message type.
   * Removes the callback from the listeners array.
   */
  public off(type: NetworkMessageType, callback: (data: any) => void) {
    if (!this.listeners.has(type)) {
      return;
    }
    const callbacks = this.listeners.get(type)!;
    const index = callbacks.indexOf(callback);
    if (index >= 0) {
      callbacks.splice(index, 1);
      console.log(`[HostNetwork] Unregistered listener for ${type}`);
    }
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
  public sendPicture(imageDataUrl: string) {
    this.broadcast({
      type: 'PICTURE',
      data: { image: imageDataUrl },
    });
  }

  /**
   * Helper to send question to players and external display.
   */
  public sendQuestion(text: string, options?: string[], type?: string) {
    this.broadcast({
      type: 'QUESTION',
      data: { text, options, type },
    });
  }

  /**
   * Helper to start timer on players and external display.
   */
  public sendTimerStart(seconds: number, silent: boolean = false) {
    this.broadcast({
      type: 'TIMER_START',
      data: { seconds, silent },
    });
    // Also send TIMER for external display countdown animation
    this.broadcast({
      type: 'TIMER',
      data: { seconds },
    });
  }

  /**
   * Helper to signal time up (lock submissions).
   */
  public sendTimeUp() {
    this.broadcast({ type: 'TIMEUP' });
    this.broadcast({ type: 'LOCK' });
  }

  /**
   * Helper to reveal the correct answer.
   */
  public sendReveal(answer: string, correctIndex?: number, type?: string) {
    this.broadcast({
      type: 'REVEAL',
      data: { answer, correctIndex, type },
    });
  }

  /**
   * Helper to show fastest team.
   */
  public sendFastest(teamName: string, questionNumber: number) {
    this.broadcast({
      type: 'FASTEST',
      data: { teamName, questionNumber },
    });
  }

  /**
   * Helper to signal next question or end round.
   */
  public sendNext() {
    this.broadcast({ type: 'NEXT' });
  }

  public sendEndRound() {
    this.broadcast({ type: 'END_ROUND' });
  }

  /**
   * Helper to update scores on external display.
   */
  public sendScores(scores: { teamId: string; teamName: string; score: number }[]) {
    this.broadcast({
      type: 'SCORES',
      data: { scores },
    });
  }

  /**
   * Register a player from the network.
   */
  public registerNetworkPlayer(playerId: string, teamName: string) {
    this.networkPlayers.set(playerId, { teamName, timestamp: Date.now() });
    this.broadcast({
      type: 'PLAYER_JOIN',
      data: { playerId, teamName },
    });
  }

  /**
   * Unregister a network player.
   */
  public unregisterNetworkPlayer(playerId: string) {
    this.networkPlayers.delete(playerId);
    this.broadcast({
      type: 'PLAYER_DISCONNECT',
      data: { playerId },
    });
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

export function broadcastMessage(payload: NetworkPayload) {
  hostNetwork.broadcast(payload);
}

export function onNetworkMessage(
  type: NetworkMessageType,
  callback: (data: any) => void
): (() => void) {
  return hostNetwork.on(type, callback);
}

export function sendPictureToPlayers(imageDataUrl: string) {
  hostNetwork.sendPicture(imageDataUrl);
}

export function sendQuestionToPlayers(text: string, options?: string[], type?: string) {
  hostNetwork.sendQuestion(text, options, type);
}

export function sendTimerToPlayers(seconds: number, silent: boolean = false) {
  hostNetwork.sendTimerStart(seconds, silent);
}

export function sendRevealToPlayers(answer: string, correctIndex?: number, type?: string) {
  hostNetwork.sendReveal(answer, correctIndex, type);
}

export function sendFastestToDisplay(teamName: string, questionNumber: number) {
  hostNetwork.sendFastest(teamName, questionNumber);
}

export function sendNextQuestion() {
  hostNetwork.sendNext();
}

export function sendEndRound() {
  hostNetwork.sendEndRound();
}

export function sendScoresToDisplay(scores: { teamId: string; teamName: string; score: number }[]) {
  hostNetwork.sendScores(scores);
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
