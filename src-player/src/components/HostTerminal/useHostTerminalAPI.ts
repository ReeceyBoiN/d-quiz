import { useCallback } from 'react';
import type { AdminCommandMessage } from '../../types/network';

interface UseHostTerminalAPIProps {
  deviceId: string;
  playerId: string;
  teamName: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
}

export function useHostTerminalAPI({
  deviceId,
  playerId,
  teamName,
  wsRef,
}: UseHostTerminalAPIProps) {
  /**
   * Send an admin command to the host
   */
  const sendAdminCommand = useCallback(
    (commandType: string, commandData?: any) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error('[HostTerminalAPI] WebSocket not connected');
        return false;
      }

      try {
        const message: AdminCommandMessage = {
          type: 'ADMIN_COMMAND',
          playerId,
          deviceId,
          teamName,
          commandType,
          commandData,
          timestamp: Date.now(),
        };

        console.log('[HostTerminalAPI] Sending admin command:', commandType, commandData);
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (err) {
        console.error('[HostTerminalAPI] Error sending admin command:', err);
        return false;
      }
    },
    [deviceId, playerId, teamName, wsRef]
  );

  /**
   * Commands for quiz pack navigation (preview only, no game flow)
   */
  const previousQuestionNav = useCallback(() => {
    return sendAdminCommand('previous-question');
  }, [sendAdminCommand]);

  const nextQuestionNav = useCallback(() => {
    return sendAdminCommand('next-question-nav');
  }, [sendAdminCommand]);

  /**
   * Commands for universal game controls
   */
  const nextQuestion = useCallback(() => {
    return sendAdminCommand('next-question');
  }, [sendAdminCommand]);

  const revealAnswer = useCallback(() => {
    return sendAdminCommand('reveal-answer');
  }, [sendAdminCommand]);

  const skipQuestion = useCallback(() => {
    return sendAdminCommand('skip-question');
  }, [sendAdminCommand]);

  const endRound = useCallback(() => {
    return sendAdminCommand('end-round');
  }, [sendAdminCommand]);

  /**
   * Commands for timer control
   */
  const startSilentTimer = useCallback((seconds: number) => {
    return sendAdminCommand('start-silent-timer', { seconds });
  }, [sendAdminCommand]);

  const startNormalTimer = useCallback((seconds: number) => {
    return sendAdminCommand('start-normal-timer', { seconds });
  }, [sendAdminCommand]);

  const stopTimer = useCallback(() => {
    return sendAdminCommand('stop-timer');
  }, [sendAdminCommand]);

  const pauseTimer = useCallback(() => {
    return sendAdminCommand('pause-timer');
  }, [sendAdminCommand]);

  const resumeTimer = useCallback(() => {
    return sendAdminCommand('resume-timer');
  }, [sendAdminCommand]);

  /**
   * Commands for team management
   */
  const editTeamName = useCallback((teamId: string, newName: string) => {
    return sendAdminCommand('edit-team-name', { teamId, newName });
  }, [sendAdminCommand]);

  const adjustScore = useCallback((teamId: string, points: number) => {
    return sendAdminCommand('adjust-score', { teamId, points });
  }, [sendAdminCommand]);

  const approvePhoto = useCallback((teamId: string) => {
    return sendAdminCommand('approve-photo', { teamId });
  }, [sendAdminCommand]);

  const declinePhoto = useCallback((teamId: string) => {
    return sendAdminCommand('decline-photo', { teamId });
  }, [sendAdminCommand]);

  const removeTeam = useCallback((teamId: string) => {
    return sendAdminCommand('remove-team', { teamId });
  }, [sendAdminCommand]);

  /**
   * Commands for on-the-spot mode
   */
  const selectQuestionType = useCallback(
    (type: 'letters' | 'numbers' | 'multiple-choice') => {
      return sendAdminCommand('select-question-type', { type });
    },
    [sendAdminCommand]
  );

  const setExpectedAnswer = useCallback((answer: string) => {
    return sendAdminCommand('set-expected-answer', { answer });
  }, [sendAdminCommand]);

  const previousQuestionType = useCallback(() => {
    return sendAdminCommand('previous-type');
  }, [sendAdminCommand]);

  const nextQuestionType = useCallback(() => {
    return sendAdminCommand('next-type');
  }, [sendAdminCommand]);

  return {
    sendAdminCommand,
    previousQuestionNav,
    nextQuestionNav,
    nextQuestion,
    revealAnswer,
    skipQuestion,
    endRound,
    startSilentTimer,
    startNormalTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    editTeamName,
    adjustScore,
    approvePhoto,
    declinePhoto,
    removeTeam,
    selectQuestionType,
    setExpectedAnswer,
    previousQuestionType,
    nextQuestionType,
  };
}
