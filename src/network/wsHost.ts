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
  | 'PLAYER_DISCONNECT'
  | 'PLAYER_AWAY'  // incoming from players when they switch tabs/windows
  | 'PLAYER_ACTIVE'  // incoming from players when they return to active state
  | 'TEAM_PHOTO_UPDATED'  // incoming from backend when player updates photo
  | 'PLAYER_BUZZER_SELECT'  // incoming from players when they select a buzzer
  | 'BUZZERS_FOLDER_CHANGED'  // broadcast to players when buzzer folder changes
  | 'CONTROLLER_AUTH_SUCCESS'  // sent to player when PIN is authenticated
  | 'CONTROLLER_AUTH_FAILED'   // sent to player when PIN authentication fails
  | 'ADMIN_COMMAND'  // incoming from controller player
  | 'ADMIN_RESPONSE'  // sent to controller confirming command execution
  | 'FLOW_STATE';  // broadcast to controller with current flow state

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
  private networkPlayers: Map<string, { teamName: string; timestamp: number; deviceId?: string }> = new Map();
  private readonly LISTENER_WARNING_THRESHOLD = 10; // Warn if listener count exceeds this

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
    const listeners = this.listeners.get(type)!;
    listeners.push(callback);

    // Warn if listener count grows suspiciously large (possible memory leak)
    if (listeners.length > this.LISTENER_WARNING_THRESHOLD) {
      console.warn(
        `[HostNetwork] ⚠️  Listener accumulation warning for "${type}": ` +
        `${listeners.length} listeners registered. ` +
        `This may indicate a memory leak if listeners aren't properly unsubscribed.`
      );
    }

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
   * Includes timerStartTime so players can accurately calculate response times using the same reference point.
   */
  public sendTimerStart(seconds: number, silent: boolean = false, timerStartTime?: number) {
    this.broadcast({
      type: 'TIMER_START',
      data: { seconds, silent, timerStartTime: timerStartTime || Date.now() },
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
  public sendReveal(answer: string, correctIndex?: number, type?: string, selectedAnswers?: string[]) {
    this.broadcast({
      type: 'REVEAL',
      data: { answer, correctIndex, type, selectedAnswers: selectedAnswers || [] },
    });
  }

  /**
   * Helper to show fastest team.
   */
  public sendFastest(teamName: string, questionNumber: number, teamPhoto?: string) {
    this.broadcast({
      type: 'FASTEST',
      data: { teamName, questionNumber, teamPhoto },
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
   * Helper to broadcast buzzer folder change to all players.
   */
  public sendBuzzerFolderChange(folderPath: string) {
    this.broadcast({
      type: 'BUZZERS_FOLDER_CHANGED',
      data: { folderPath },
    });
  }

  /**
   * Helper to broadcast current flow state to host controller.
   * Now includes question data for remote controller preview
   */
  public sendFlowState(flow: string, isQuestionMode: boolean, questionData?: any) {
    this.broadcast({
      type: 'FLOW_STATE',
      data: {
        flow,
        isQuestionMode,
        currentQuestion: questionData?.currentQuestion,
        currentLoadedQuestionIndex: questionData?.currentLoadedQuestionIndex,
        loadedQuizQuestions: questionData?.loadedQuizQuestions,
        isQuizPackMode: questionData?.isQuizPackMode,
      },
    });
  }

  /**
   * Register a player from the network.
   */
  public registerNetworkPlayer(playerId: string, teamName: string, deviceId?: string) {
    this.networkPlayers.set(playerId, { teamName, timestamp: Date.now(), deviceId });
    this.broadcast({
      type: 'PLAYER_JOIN',
      data: { playerId, teamName, deviceId },
    });
  }

  /**
   * Unregister a network player.
   */
  public unregisterNetworkPlayer(playerId: string) {
    const player = this.networkPlayers.get(playerId);
    const deviceId = player?.deviceId;
    this.networkPlayers.delete(playerId);
    this.broadcast({
      type: 'PLAYER_DISCONNECT',
      data: { playerId, deviceId },
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

  /**
   * Get listener counts by message type (for debugging memory leaks).
   */
  public getListenerCounts(): Record<NetworkMessageType, number> {
    const counts: Record<string, number> = {};
    this.listeners.forEach((callbacks, type) => {
      counts[type] = callbacks.length;
    });
    return counts as Record<NetworkMessageType, number>;
  }

  /**
   * Log all current listener counts (for debugging).
   */
  public debugLogListeners(): void {
    const counts = this.getListenerCounts();
    const totalListeners = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`[HostNetwork] Total listeners: ${totalListeners}`);
    Object.entries(counts).forEach(([type, count]) => {
      if (count > 0) {
        const warning = count > this.LISTENER_WARNING_THRESHOLD ? ' ⚠️' : '';
        console.log(`  - ${type}: ${count}${warning}`);
      }
    });
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

export function sendTimerToPlayers(seconds: number, silent: boolean = false, timerStartTime?: number) {
  hostNetwork.sendTimerStart(seconds, silent, timerStartTime);
}

export function sendRevealToPlayers(answer: string, correctIndex?: number, type?: string) {
  hostNetwork.sendReveal(answer, correctIndex, type);
}

export function sendFastestToDisplay(teamName: string, questionNumber: number, teamPhoto?: string) {
  hostNetwork.sendFastest(teamName, questionNumber, teamPhoto);
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

export function registerNetworkPlayer(playerId: string, teamName: string, deviceId?: string) {
  hostNetwork.registerNetworkPlayer(playerId, teamName, deviceId);
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

export function sendTimeUpToPlayers() {
  // Send local listeners first (for internal displays)
  hostNetwork.sendTimeUp();

  // Send via IPC to backend/WebSocket for remote players (Electron)
  try {
    const api = (window as any)?.api;
    if (api?.network?.broadcastTimeUp) {
      console.log('[wsHost] Calling IPC broadcastTimeUp to notify players');
      api.network.broadcastTimeUp().catch((err: any) => {
        console.error('[wsHost] IPC broadcastTimeUp error:', err);
      });
    } else {
      console.log('[wsHost] broadcastTimeUp IPC not available (browser mode or dev)');
    }
  } catch (err) {
    console.error('[wsHost] Error calling broadcastTimeUp IPC:', err);
  }
}

export function sendBuzzerFolderChangeToPlayers(folderPath: string) {
  // Send local listeners first (for internal displays)
  hostNetwork.sendBuzzerFolderChange(folderPath);

  // Send via IPC to backend/WebSocket for remote players (Electron)
  try {
    const api = (window as any)?.api;
    if (api?.network?.broadcastBuzzerFolderChange) {
      console.log('[wsHost] Calling IPC broadcastBuzzerFolderChange to notify players:', folderPath);
      api.network.broadcastBuzzerFolderChange(folderPath).catch((err: any) => {
        console.error('[wsHost] IPC broadcastBuzzerFolderChange error:', err);
      });
    } else {
      console.log('[wsHost] broadcastBuzzerFolderChange IPC not available (browser mode or dev)');
    }
  } catch (err) {
    console.error('[wsHost] Error calling broadcastBuzzerFolderChange IPC:', err);
  }
}

/**
 * Send current flow state to host controller
 * This sends the current game flow state so the controller knows what action comes next
 * Also includes question data for remote controller preview
 *
 * IMPORTANT: Uses HTTP API fallback to send to remote controller via WebSocket
 * not the in-process broadcast which only works for local listeners
 *
 * @param flow - Current flow state (e.g., 'question', 'timer', 'reveal')
 * @param isQuestionMode - Whether in question mode
 * @param questionData - Optional question data to include
 * @param deviceId - Target controller device ID
 * @param backendUrl - Backend URL for HTTP API calls (REQUIRED for proper delivery)
 */
export async function sendFlowStateToController(flow: string, isQuestionMode: boolean, questionData?: any, deviceId?: string, backendUrl?: string) {
  console.log('[wsHost] 🚀 sendFlowStateToController called', {
    flow,
    isQuestionMode,
    deviceId,
    hasQuestionData: !!questionData,
    backendUrl,
  });

  if (!deviceId) {
    console.warn('[wsHost] ❌ NO DEVICE ID - cannot send FLOW_STATE');
    return;
  }

  const payload = {
    type: 'FLOW_STATE',
    data: {
      flow,
      isQuestionMode,
      currentQuestion: questionData?.currentQuestion,
      currentLoadedQuestionIndex: questionData?.currentLoadedQuestionIndex,
      loadedQuizQuestions: questionData?.loadedQuizQuestions,
      isQuizPackMode: questionData?.isQuizPackMode,
      selectedQuestionType: questionData?.selectedQuestionType,
    },
    timestamp: Date.now()
  };

  console.log('[wsHost] 📦 FLOW_STATE payload ready', {
    flow: payload.data.flow,
    isQuestionMode: payload.data.isQuestionMode,
    targetDeviceId: deviceId,
    payloadSize: JSON.stringify(payload).length,
  });

  // Try IPC method first (Electron)
  try {
    const api = (window as any)?.api;
    if (api?.network?.sendToPlayer) {
      console.log('[wsHost] 📤 Attempting to send FLOW_STATE via IPC...');
      try {
        // Use correct IPC format: {deviceId, messageType, data}
        // Exclude loadedQuizQuestions from data to keep payload small
        const ipcPayload = {
          deviceId,
          messageType: 'FLOW_STATE',
          data: {
            flow: payload.data.flow,
            isQuestionMode: payload.data.isQuestionMode,
            currentQuestion: payload.data.currentQuestion,
            currentLoadedQuestionIndex: payload.data.currentLoadedQuestionIndex,
            isQuizPackMode: payload.data.isQuizPackMode,
            selectedQuestionType: questionData?.selectedQuestionType,
            // NOTE: loadedQuizQuestions intentionally excluded to keep IPC payload small
          }
        };
        await api.network.sendToPlayer(ipcPayload);
        console.log('[wsHost] ✅ FLOW_STATE sent via IPC successfully');
        return;
      } catch (ipcErr) {
        console.error('[wsHost] ❌ IPC sendToPlayer failed for FLOW_STATE:', ipcErr);
        console.log('[wsHost] Falling back to HTTP API...');
      }
    } else {
      console.log('[wsHost] ℹ️ sendToPlayer IPC not available (browser mode or dev) - using HTTP API');
    }
  } catch (err) {
    console.error('[wsHost] ❌ Error attempting IPC send:', err);
  }

  // Fallback to HTTP API (like sendControllerAuthToPlayer does)
  try {
    console.log('[wsHost] 📤 Attempting to send FLOW_STATE via HTTP API...');

    // Use provided backendUrl, otherwise try to get from window
    let resolvedBackendUrl = backendUrl;
    if (!resolvedBackendUrl) {
      resolvedBackendUrl = (window as any).__BACKEND_URL__;
      if (!resolvedBackendUrl) {
        console.warn('[wsHost] ❌ No backendUrl provided and __BACKEND_URL__ not set - FLOW_STATE may not reach remote controller');
        return;
      }
    }

    console.log('[wsHost] Using backend URL:', resolvedBackendUrl);

    // Format payload correctly for backend endpoint: {deviceId, messageType, data}
    // IMPORTANT: Exclude loadedQuizQuestions to avoid 413 Payload Too Large error
    const httpPayload = {
      deviceId,
      messageType: 'FLOW_STATE',
      data: {
        flow: payload.data.flow,
        isQuestionMode: payload.data.isQuestionMode,
        currentQuestion: payload.data.currentQuestion,
        currentLoadedQuestionIndex: payload.data.currentLoadedQuestionIndex,
        isQuizPackMode: payload.data.isQuizPackMode,
        selectedQuestionType: questionData?.selectedQuestionType,
        // NOTE: loadedQuizQuestions is intentionally excluded - it's too large for HTTP API
      }
    };

    const response = await fetch(`${resolvedBackendUrl}/api/send-to-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(httpPayload)
    });

    if (!response.ok) {
      console.error('[wsHost] ❌ HTTP API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[wsHost] Error response body:', errorText);
      return;
    }

    const result = await response.json();
    console.log('[wsHost] ✅ FLOW_STATE sent via HTTP API successfully:', {
      flow: result.flow,
      deviceId: result.deviceId,
      timestamp: result.timestamp,
    });
  } catch (err) {
    console.error('[wsHost] ❌ Error sending FLOW_STATE via HTTP API:', err);
  }
}

/**
 * Send controller authentication success message to a specific player
 * This is called when a player authenticates with the correct PIN
 */
export function sendControllerAuthSuccess(deviceId: string, message?: string) {
  console.log('[wsHost] Sending CONTROLLER_AUTH_SUCCESS to device:', deviceId);

  // Send via IPC to backend for remote player delivery
  try {
    const api = (window as any)?.api;
    if (api?.network?.sendToPlayer) {
      api.network.sendToPlayer({
        deviceId,
        messageType: 'CONTROLLER_AUTH_SUCCESS',
        data: {
          message: message || 'Controller authenticated'
        }
      }).catch((err: any) => {
        console.error('[wsHost] IPC sendToPlayer error:', err);
      });
    } else {
      console.log('[wsHost] sendToPlayer IPC not available, using fallback broadcast');
      // Fallback: broadcast to all (less ideal but works)
      hostNetwork.broadcast({
        type: 'CONTROLLER_AUTH_SUCCESS',
        data: { deviceId, message: message || 'Controller authenticated' }
      });
    }
  } catch (err) {
    console.error('[wsHost] Error sending controller auth success:', err);
  }
}

/**
 * Send controller authentication failure message to a specific player
 */
export function sendControllerAuthFailed(deviceId: string, message?: string) {
  console.log('[wsHost] Sending CONTROLLER_AUTH_FAILED to device:', deviceId);

  // Send via IPC to backend for remote player delivery
  try {
    const api = (window as any)?.api;
    if (api?.network?.sendToPlayer) {
      api.network.sendToPlayer({
        deviceId,
        messageType: 'CONTROLLER_AUTH_FAILED',
        data: {
          message: message || 'Controller authentication failed'
        }
      }).catch((err: any) => {
        console.error('[wsHost] IPC sendToPlayer error:', err);
      });
    } else {
      console.log('[wsHost] sendToPlayer IPC not available, using fallback broadcast');
      hostNetwork.broadcast({
        type: 'CONTROLLER_AUTH_FAILED',
        data: { deviceId, message: message || 'Controller authentication failed' }
      });
    }
  } catch (err) {
    console.error('[wsHost] Error sending controller auth failed:', err);
  }
}

/**
 * Register a listener for admin commands from controllers
 * This allows QuizHost to receive and process admin commands from remote controllers
 */
export function onAdminCommand(
  callback: (data: any) => void
): (() => void) {
  console.log('[wsHost] Registering admin command listener');
  return hostNetwork.on('ADMIN_COMMAND' as any, callback);
}

/**
 * Send admin response back to the controller
 * This confirms that the admin command was processed
 *
 * @param deviceId - Target controller device ID
 * @param commandType - Type of command that was executed
 * @param success - Whether the command succeeded
 * @param message - Optional message about the command result
 * @param data - Optional additional data to send back
 * @param backendUrl - Backend URL for HTTP API calls
 */
export function sendAdminResponse(
  deviceId: string,
  commandType: string,
  success: boolean,
  message?: string,
  data?: any,
  backendUrl?: string
) {
  console.log('[wsHost] Sending ADMIN_RESPONSE to device:', deviceId, 'command:', commandType, 'hasBackendUrl:', !!backendUrl);

  const payload = {
    type: 'ADMIN_RESPONSE',
    commandType,
    success,
    message: message || (success ? 'Command executed' : 'Command failed'),
    data,
    timestamp: Date.now()
  };

  // Try IPC method first (Electron)
  try {
    const api = (window as any)?.api;
    if (api?.network?.sendToPlayer) {
      api.network.sendToPlayer({
        deviceId,
        messageType: 'ADMIN_RESPONSE',
        data: payload
      }).catch((err: any) => {
        console.error('[wsHost] IPC sendToPlayer error:', err);
        console.log('[wsHost] Falling back to HTTP API for ADMIN_RESPONSE...');
      });
      return; // IPC attempted, don't continue to HTTP
    } else {
      console.log('[wsHost] sendToPlayer IPC not available, will use HTTP API');
    }
  } catch (err) {
    console.error('[wsHost] Error attempting IPC send:', err);
  }

  // Fallback to HTTP API
  try {
    let resolvedBackendUrl = backendUrl;
    if (!resolvedBackendUrl) {
      resolvedBackendUrl = (window as any).__BACKEND_URL__;
      if (!resolvedBackendUrl) {
        console.warn('[wsHost] No backendUrl provided and __BACKEND_URL__ not set - ADMIN_RESPONSE may not reach remote controller');
        return;
      }
    }

    console.log('[wsHost] Sending ADMIN_RESPONSE via HTTP API to:', resolvedBackendUrl);

    // Format payload correctly for backend endpoint: {deviceId, messageType, data}
    const httpPayload = {
      deviceId,
      messageType: 'ADMIN_RESPONSE',
      data: payload
    };

    fetch(`${resolvedBackendUrl}/api/send-to-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(httpPayload)
    }).then(response => {
      if (!response.ok) {
        console.error('[wsHost] HTTP API error for ADMIN_RESPONSE:', response.status, response.statusText);
      } else {
        console.log('[wsHost] ✅ ADMIN_RESPONSE sent via HTTP API');
      }
    }).catch((err: any) => {
      console.error('[wsHost] Error sending ADMIN_RESPONSE via HTTP API:', err);
    });
  } catch (err) {
    console.error('[wsHost] Error in sendAdminResponse fallback:', err);
  }
}

/**
 * Debug function to check for listener accumulation (memory leak detection).
 * Call this from browser console if you suspect listener leaks.
 */
export function debugNetworkListeners() {
  hostNetwork.debugLogListeners();
  return hostNetwork.getListenerCounts();
}
