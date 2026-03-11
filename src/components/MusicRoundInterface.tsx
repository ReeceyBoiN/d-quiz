import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import {
  Folder,
  FolderOpen,
  Music,
  X,
  FileAudio,
  Play,
  SkipForward,
  Shuffle,
  GripVertical,
  Volume2,
  Check,
  ChevronRight,
  Square,
  Target,
  Zap,
  Trophy,
  Skull,
  RotateCcw,
  Eye,
  Award,
} from "lucide-react";
import { getMusicRoundsPath, listDirectory, type FileEntry } from "../utils/fileBrowser";
import { useSettings } from "../utils/SettingsContext";
import {
  loadClips,
  playClipSequence,
  previewClip,
  setMasterVolume,
  getCurrentPlaybackState,
  type MusicClip,
  type PlaybackHandle,
} from "../utils/musicRoundAudio";
import { playApplauseSound } from "../utils/audioUtils";
import { onNetworkMessage } from "../network/wsHost";
import { calculateTeamPoints, rankCorrectTeams, type ScoringConfig, type TeamScoreData } from "../utils/scoringEngine";

// IPC helpers for broadcasting to real player devices
async function broadcastToPlayers(messageType: string, data: any) {
  try {
    if ((window as any).api?.network?.broadcastMusicRound) {
      await (window as any).api.network.broadcastMusicRound({ messageType, data });
    } else {
      console.warn('[MusicRound] api.network.broadcastMusicRound not available (browser mode)');
    }
  } catch (err) {
    console.error(`[MusicRound] Error broadcasting ${messageType}:`, err);
  }
}

async function sendToPlayer(deviceId: string, messageType: string, data: any) {
  try {
    if ((window as any).api?.network?.sendToPlayer) {
      await (window as any).api.network.sendToPlayer({ deviceId, messageType, data });
    } else {
      console.warn('[MusicRound] api.network.sendToPlayer not available (browser mode)');
    }
  } catch (err) {
    console.error(`[MusicRound] Error sending ${messageType} to ${deviceId}:`, err);
  }
}

// Types matching QuizHost Quiz interface
interface Team {
  id: string;
  name: string;
  score?: number;
  buzzerSound?: string;
  photoUrl?: string;
}

interface MusicRoundInterfaceProps {
  onClose: () => void;
  teams: Team[];
  onScoreChange: (teamId: string, change: number) => void;
  onEndRound: () => void;
  onShowFastestTeam?: (team: Team, responseTime: number) => void;
  onExternalDisplayUpdate?: (content: string, data?: any) => void;
}

type Phase = "setup" | "gameplay";
type SortOrder = "name" | "newest" | "oldest";
type GameplayStep = "target-selection" | "playlist-ready" | "playing" | "reveal-answer" | "fastest-team" | "next-round";

const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".flac", ".mp4"];

function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface BuzzRecord {
  teamId: string;
  teamName: string;
  timestamp: number;
  clipId: string;
  valid: boolean;
  responseTime?: number;
  deviceId?: string;
}

export function MusicRoundInterface({
  onClose,
  teams,
  onScoreChange,
  onEndRound,
  onShowFastestTeam,
  onExternalDisplayUpdate,
}: MusicRoundInterfaceProps) {
  const settings = useSettings();

  // --- Phase state ---
  const [phase, setPhase] = useState<Phase>("setup");

  // --- Setup: Folder browser ---
  const [rootPath, setRootPath] = useState("");
  const [folders, setFolders] = useState<FileEntry[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FileEntry | null>(null);
  const [folderContents, setFolderContents] = useState<FileEntry[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Setup: Track list ---
  const [tracks, setTracks] = useState<{ name: string; path: string }[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // --- Setup: Round config ---
  const [clipLength, setClipLength] = useState(settings.musicRoundDefaultClipLength);
  const [basePoints, setBasePoints] = useState(settings.musicRoundDefaultPoints);
  const [speedBonus, setSpeedBonus] = useState(settings.musicRoundDefaultSpeedBonus);
  const [masterVolume, setMasterVolumeState] = useState(settings.musicRoundDefaultVolume);
  const [eliminationEnabled, setEliminationEnabled] = useState(settings.musicRoundElimination);
  const [evilMode, setEvilMode] = useState(settings.evilModeEnabled);
  const [punishmentMode, setPunishmentMode] = useState(settings.punishmentEnabled);
  const [reversedEnabled, setReversedEnabled] = useState(settings.musicRoundReversed);

  // --- Loading state ---
  const [isLoadingClips, setIsLoadingClips] = useState(false);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });

  // --- Gameplay state ---
  const [loadedClips, setLoadedClips] = useState<MusicClip[]>([]);
  const [remainingClips, setRemainingClips] = useState<MusicClip[]>([]);
  const [targetClip, setTargetClip] = useState<MusicClip | null>(null);
  const [playbackSequence, setPlaybackSequence] = useState<MusicClip[]>([]);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);
  const [currentPlayingClipId, setCurrentPlayingClipId] = useState<string>("");
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(-1);
  const [clipProgress, setClipProgress] = useState(0);
  const [buzzes, setBuzzes] = useState<BuzzRecord[]>([]);
  const [lockedTeams, setLockedTeams] = useState<Set<string>>(new Set());
  const [roundComplete, setRoundComplete] = useState(false);
  const [gameplayStep, setGameplayStep] = useState<GameplayStep>("target-selection");
  const [scoresAwarded, setScoresAwarded] = useState(false);

  const playbackHandleRef = useRef<PlaybackHandle | null>(null);
  const clipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewHandleRef = useRef<{ stop: () => void } | null>(null);
  const buzzListenerRef = useRef<(() => void) | null>(null);
  const clipStartTimeRef = useRef<number>(0);
  const clipEndTimeRef = useRef<number>(0);
  const currentClipIdRef = useRef<string>("");
  const targetClipIdRef = useRef<string>("");
  const lockedTeamsRef = useRef<Set<string>>(new Set());
  const currentPlayingClipNameRef = useRef<string>("");
  const fastestTeamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Folder loading ---
  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const path = await getMusicRoundsPath();
      setRootPath(path);
      const entries = await listDirectory(path);
      setFolders(entries.filter((e) => e.isDirectory));
    } catch (err: any) {
      console.error("[MusicRound] Failed to load:", err);
      setError("Could not load Music Rounds folder.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // --- Load folder contents ---
  useEffect(() => {
    if (!selectedFolder) {
      setFolderContents([]);
      setTracks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const entries = await listDirectory(selectedFolder.path);
        if (!cancelled) {
          const audioFiles = entries
            .filter((e) => !e.isDirectory && isAudioFile(e.name))
            .slice(0, 18); // Max 18
          setFolderContents(audioFiles);
          setTracks(audioFiles.map((f) => ({ name: f.name, path: f.path })));
        }
      } catch (err) {
        console.error("[MusicRound] Failed to list folder:", err);
        if (!cancelled) {
          setFolderContents([]);
          setTracks([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedFolder]);

  // --- Sort folders ---
  const sortedFolders = [...folders].sort((a, b) => {
    switch (sortOrder) {
      case "name": return a.name.localeCompare(b.name);
      case "newest": return b.name.localeCompare(a.name);
      case "oldest": return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  // --- Drag and drop reorder ---
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newTracks = [...tracks];
    const [removed] = newTracks.splice(dragIndex, 1);
    newTracks.splice(index, 0, removed);
    setTracks(newTracks);
    setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  // --- Shuffle tracks ---
  const shuffleTracks = () => {
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setTracks(shuffled);
  };

  // --- Shuffle playback sequence (gameplay) ---
  const shufflePlaybackSequence = () => {
    if (!targetClip || remainingClips.length === 0) return;
    const otherClips = remainingClips.filter((c) => c.id !== targetClip.id);
    const shuffled = [...otherClips];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const insertPos = Math.floor(Math.random() * (shuffled.length + 1));
    shuffled.splice(insertPos, 0, targetClip);
    setPlaybackSequence(shuffled);
  };

  // --- Playback sequence drag reorder ---
  const [seqDragIndex, setSeqDragIndex] = useState<number | null>(null);
  const handleSeqDragStart = (index: number) => setSeqDragIndex(index);
  const handleSeqDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (seqDragIndex === null || seqDragIndex === index) return;
    const newSeq = [...playbackSequence];
    const [removed] = newSeq.splice(seqDragIndex, 1);
    newSeq.splice(index, 0, removed);
    setPlaybackSequence(newSeq);
    setSeqDragIndex(index);
  };
  const handleSeqDragEnd = () => setSeqDragIndex(null);

  // --- Preview a track ---
  const handlePreviewTrack = async (track: { name: string; path: string }) => {
    // Stop any existing preview
    if (previewHandleRef.current) {
      previewHandleRef.current.stop();
      previewHandleRef.current = null;
      return;
    }
    try {
      const { loadAudioFile, autoSelectRegion } = await import("../utils/musicRoundAudio");
      const { buffer, duration } = await loadAudioFile(track.path);
      const region = autoSelectRegion(duration, clipLength);
      const handle = previewClip(buffer, region.start, region.end, masterVolume, reversedEnabled);
      previewHandleRef.current = handle;
    } catch (err) {
      console.error("[MusicRound] Preview failed:", err);
    }
  };

  // --- Start Round ---
  const handleStartRound = async () => {
    if (tracks.length === 0) return;

    setIsLoadingClips(true);
    setLoadProgress({ loaded: 0, total: tracks.length });

    try {
      const clips = await loadClips(tracks, clipLength, (loaded, total) => {
        setLoadProgress({ loaded, total });
      }, reversedEnabled);

      if (clips.length === 0) {
        setError("No clips could be loaded.");
        setIsLoadingClips(false);
        return;
      }

      setLoadedClips(clips);
      setRemainingClips([...clips]);
      setPhase("gameplay");
      setGameplayStep("target-selection");

      // Broadcast to players via IPC
      await broadcastToPlayers('MUSIC_ROUND_START', { clipCount: clips.length });
    } catch (err) {
      console.error("[MusicRound] Failed to load clips:", err);
      setError("Failed to load audio clips.");
    } finally {
      setIsLoadingClips(false);
    }
  };

  // --- Listen for buzzes ---
  useEffect(() => {
    if (phase !== "gameplay") return;

    const handleBuzzMessage = (data: any) => {
      const { playerId, deviceId, teamName, timestamp } = data;
      handleBuzzRef.current(teamName, timestamp, deviceId);
    };

    const unsubscribe = onNetworkMessage('MUSIC_BUZZ' as any, handleBuzzMessage);

    buzzListenerRef.current = unsubscribe;
    return () => {
      unsubscribe();
      buzzListenerRef.current = null;
    };
  }, [phase]);

  // --- Handle incoming buzz (using ref to avoid stale closures) ---
  const handleBuzzRef = useRef<(teamName: string, timestamp: number, deviceId: string) => void>(() => {});

  useEffect(() => {
    handleBuzzRef.current = (teamName: string, timestamp: number, deviceId: string) => {
      const team = teams.find((t) => t.name === teamName);
      if (!team) return;

      // Already buzzed this round?
      if (lockedTeamsRef.current.has(team.id)) return;

      const playState = getCurrentPlaybackState();
      if (!playState || !playState.isPlaying) return;

      const now = Date.now();
      const currentClipId = currentClipIdRef.current;
      const targetId = targetClipIdRef.current;
      const clipStart = clipStartTimeRef.current;
      const clipEnd = clipEndTimeRef.current;

      if (clipStart === 0) return;
      if (now > clipEnd) return;

      if (now >= clipStart && now <= clipEnd) {
        if (currentClipId === targetId) {
          const responseTime = timestamp - clipStart;
          const record: BuzzRecord = {
            teamId: team.id,
            teamName: team.name,
            timestamp,
            clipId: currentClipId,
            valid: true,
            responseTime,
            deviceId,
          };

          setBuzzes((prev) => [...prev, record]);
          setLockedTeams((prev) => {
            const next = new Set(prev).add(team.id);
            lockedTeamsRef.current = next;
            return next;
          });

          sendToPlayer(deviceId, 'MUSIC_ROUND_BUZZ_RESULT', { deviceId, teamName, valid: true, responseTime });
        } else {
          const record: BuzzRecord = {
            teamId: team.id,
            teamName: team.name,
            timestamp,
            clipId: currentClipId,
            valid: false,
            deviceId,
          };

          setBuzzes((prev) => [...prev, record]);
          setLockedTeams((prev) => {
            const next = new Set(prev).add(team.id);
            lockedTeamsRef.current = next;
            return next;
          });

          sendToPlayer(deviceId, 'MUSIC_ROUND_BUZZ_RESULT', { deviceId, teamName, valid: false, reason: 'wrong_clip' });
        }
      }
    };
  }, [teams]);

  // --- Select target clip ---
  const selectTarget = (clip: MusicClip) => {
    setTargetClip(clip);
    targetClipIdRef.current = clip.id;

    // Build shuffled playback sequence with target at random position
    const otherClips = remainingClips.filter((c) => c.id !== clip.id);
    const shuffled = [...otherClips];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const insertPos = Math.floor(Math.random() * (shuffled.length + 1));
    shuffled.splice(insertPos, 0, clip);
    setPlaybackSequence(shuffled);

    // Reset buzzes and locks for this target round
    setBuzzes([]);
    setLockedTeams(new Set());
    lockedTeamsRef.current = new Set();
    setScoresAwarded(false);

    setGameplayStep("playlist-ready");

    // Broadcast target to players via IPC
    broadcastToPlayers('MUSIC_ROUND_TARGET', { clipName: clip.name });

    // Update external display
    if (onExternalDisplayUpdate) {
      onExternalDisplayUpdate('question', {
        text: `Buzz when you hear: ${clip.name}`,
        type: 'music-buzz',
      });
    }
  };

  // --- Random target ---
  const selectRandomTarget = () => {
    if (remainingClips.length === 0) return;
    const randomIndex = Math.floor(Math.random() * remainingClips.length);
    selectTarget(remainingClips[randomIndex]);
  };

  // --- Start playback ---
  const startPlayback = () => {
    if (playbackSequence.length === 0 || !targetClip) return;

    setIsPlaybackActive(true);
    setCurrentPlayingIndex(-1);
    setClipProgress(0);
    setGameplayStep("playing");

    const handle = playClipSequence(
      playbackSequence,
      masterVolume,
      (clipId, clipIndex, startTime, endTime) => {
        currentClipIdRef.current = clipId;
        clipStartTimeRef.current = startTime;
        clipEndTimeRef.current = endTime;
        setCurrentPlayingClipId(clipId);
        setCurrentPlayingIndex(clipIndex);
        setClipProgress(0);

        // Find clip name for broadcasting
        const playingClip = playbackSequence.find(c => c.id === clipId);
        currentPlayingClipNameRef.current = playingClip?.name || '';

        // Broadcast now-playing to player devices
        broadcastToPlayers('MUSIC_ROUND_NOW_PLAYING' as any, {
          clipName: playingClip?.name || 'Unknown',
          clipIndex: clipIndex,
          totalClips: playbackSequence.length,
        });

        // Update external display with now playing
        if (onExternalDisplayUpdate) {
          onExternalDisplayUpdate('question', {
            text: `Now Playing: ${playingClip?.name || 'Unknown'}\n\nBuzz when you hear: ${targetClip?.name}`,
            type: 'music-buzz',
          });
        }

        // Start progress timer
        if (clipTimerRef.current) clearInterval(clipTimerRef.current);
        const duration = endTime - startTime;
        clipTimerRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const pct = Math.min(100, (elapsed / duration) * 100);
          setClipProgress(pct);
        }, 50);
      },
      () => {
        // onPlaybackEnd - all clips finished (shouldn't normally happen with target stop)
        if (clipTimerRef.current) clearInterval(clipTimerRef.current);
        setIsPlaybackActive(false);
        setClipProgress(100);
        setGameplayStep("reveal-answer");
      },
      targetClip.id,
      () => {
        // onTargetClipFinished - target clip has finished, auto-stop
        if (clipTimerRef.current) clearInterval(clipTimerRef.current);
        setIsPlaybackActive(false);
        setClipProgress(100);
        setGameplayStep("reveal-answer");

        // Update external display that playback stopped
        if (onExternalDisplayUpdate) {
          onExternalDisplayUpdate('question', {
            text: `Target clip played!\n\nThe answer will be revealed shortly...`,
            type: 'music-buzz',
          });
        }
      }
    );

    playbackHandleRef.current = handle;
  };

  // --- Reveal Answer ---
  const handleRevealAnswer = async () => {
    if (!targetClip) return;

    // Play applause sound
    try {
      await playApplauseSound();
    } catch (err) {
      console.error('[MusicRound] Failed to play applause:', err);
    }

    // Calculate and award scores
    calculateAndAwardScores();

    // Broadcast reveal to players
    broadcastToPlayers('MUSIC_ROUND_REVEAL', {
      clipName: targetClip.name,
      revealed: true,
    });

    // Update external display with answer reveal
    if (onExternalDisplayUpdate) {
      onExternalDisplayUpdate('question', {
        text: `The answer was: ${targetClip.name}`,
        type: 'music-buzz',
      });
    }

    setGameplayStep("fastest-team");
  };

  // --- Show Fastest Team ---
  const handleShowFastestTeam = () => {
    const validBuzzes = buzzes.filter((b) => b.valid).sort((a, b) => (a.responseTime ?? 0) - (b.responseTime ?? 0));

    if (validBuzzes.length > 0) {
      const fastestBuzz = validBuzzes[0];
      const fastestTeam = teams.find((t) => t.id === fastestBuzz.teamId);
      if (fastestTeam && onShowFastestTeam) {
        onShowFastestTeam(fastestTeam, fastestBuzz.responseTime!);
      }

      // Update external display with fastest team
      if (onExternalDisplayUpdate) {
        onExternalDisplayUpdate('fastestTeam', {
          teamName: fastestTeam?.name,
          teamPhoto: fastestTeam?.photoUrl,
        });
      }

      // Broadcast fastest to players
      broadcastToPlayers('MUSIC_ROUND_FASTEST', {
        teamName: fastestTeam?.name,
        teamPhoto: fastestTeam?.photoUrl,
        responseTime: fastestBuzz.responseTime,
      });
    }

    // Auto-advance to next-round after a delay
    if (fastestTeamTimeoutRef.current) clearTimeout(fastestTeamTimeoutRef.current);
    fastestTeamTimeoutRef.current = setTimeout(() => {
      setGameplayStep("next-round");
      fastestTeamTimeoutRef.current = null;
    }, 4000);
  };

  // --- Stop playback ---
  const stopPlayback = () => {
    if (playbackHandleRef.current) {
      playbackHandleRef.current.stop();
      playbackHandleRef.current = null;
    }
    if (clipTimerRef.current) {
      clearInterval(clipTimerRef.current);
      clipTimerRef.current = null;
    }
    setIsPlaybackActive(false);
  };

  // --- Skip to next clip ---
  const skipClip = () => {
    if (clipTimerRef.current) {
      clearInterval(clipTimerRef.current);
      clipTimerRef.current = null;
    }
    if (playbackHandleRef.current) {
      playbackHandleRef.current.skipToNext();
    }
  };

  // --- Calculate and award scores ---
  const calculateAndAwardScores = () => {
    if (scoresAwarded) return;
    setScoresAwarded(true);

    const validBuzzes = buzzes.filter((b) => b.valid);
    const invalidBuzzes = buzzes.filter((b) => !b.valid);
    const buzzedTeamIds = new Set(buzzes.map((b) => b.teamId));

    const rankings = rankCorrectTeams(
      validBuzzes.map((b) => ({ teamId: b.teamId, responseTime: b.responseTime! }))
    );

    const config: ScoringConfig = {
      pointsValue: basePoints,
      speedBonusValue: speedBonus,
      evilModeEnabled: evilMode,
      punishmentModeEnabled: punishmentMode,
      staggeredEnabled: true,
      goWideEnabled: false,
    };

    validBuzzes.forEach((buzz) => {
      const teamData: TeamScoreData = {
        teamId: buzz.teamId,
        correctAnswer: true,
        noAnswer: false,
        answerCount: 1,
        responseTime: buzz.responseTime!,
        rank: rankings[buzz.teamId],
      };
      const result = calculateTeamPoints(teamData, config, validBuzzes.length);
      if (result.totalPoints !== 0) {
        onScoreChange(buzz.teamId, result.totalPoints);
      }
    });

    if (evilMode) {
      invalidBuzzes.forEach((buzz) => {
        onScoreChange(buzz.teamId, -basePoints);
      });
    }

    if (punishmentMode) {
      teams.forEach((team) => {
        if (!buzzedTeamIds.has(team.id)) {
          onScoreChange(team.id, -basePoints);
        }
      });
    }
  };

  // --- Next target (after fastest team shown) ---
  const handleNextTarget = () => {
    if (eliminationEnabled && targetClip) {
      const updated = remainingClips.filter((c) => c.id !== targetClip.id);
      setRemainingClips(updated);

      if (updated.length <= 1) {
        setRoundComplete(true);
        setGameplayStep("target-selection");
        return;
      }
    }

    // Reset for next target selection
    setTargetClip(null);
    targetClipIdRef.current = "";
    setPlaybackSequence([]);
    setBuzzes([]);
    setLockedTeams(new Set());
    lockedTeamsRef.current = new Set();
    setScoresAwarded(false);
    setCurrentPlayingClipId("");
    setCurrentPlayingIndex(-1);
    setGameplayStep("target-selection");

    // Reset player buzzers via IPC
    broadcastToPlayers('MUSIC_ROUND_RESET', {});
  };

  // --- End round ---
  const handleEndRound = () => {
    stopPlayback();
    if (previewHandleRef.current) {
      previewHandleRef.current.stop();
      previewHandleRef.current = null;
    }

    broadcastToPlayers('MUSIC_ROUND_END', {});

    onEndRound();
  };

  // --- Volume change ---
  const handleVolumeChange = (vol: number) => {
    setMasterVolumeState(vol);
    setMasterVolume(vol);
  };

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      stopPlayback();
      if (previewHandleRef.current) {
        previewHandleRef.current.stop();
        previewHandleRef.current = null;
      }
      if (clipTimerRef.current) {
        clearInterval(clipTimerRef.current);
        clipTimerRef.current = null;
      }
      if (buzzListenerRef.current) {
        buzzListenerRef.current();
        buzzListenerRef.current = null;
      }
      if (fastestTeamTimeoutRef.current) {
        clearTimeout(fastestTeamTimeoutRef.current);
        fastestTeamTimeoutRef.current = null;
      }
    };
  }, []);

  // --- Render Setup Phase ---
  if (phase === "setup") {
    return (
      <div className="flex-1 h-full flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Music className="h-5 w-5 text-[rgba(255,127,39,1)]" />
            <h2 className="text-lg font-semibold text-card-foreground">Music Round Setup</h2>
          </div>
        </div>

        {/* Action Bar (Close + Start Round) */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-card/80">
          <Button onClick={onClose} variant="outline" size="sm">
            <X className="h-4 w-4 mr-2" /> Close
          </Button>

          {isLoadingClips ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Loading clips... {loadProgress.loaded}/{loadProgress.total}</span>
              <Progress value={(loadProgress.loaded / Math.max(loadProgress.total, 1)) * 100} className="w-32" />
            </div>
          ) : (
            <Button
              onClick={handleStartRound}
              disabled={tracks.length === 0}
              className="bg-[rgba(255,127,39,1)] hover:bg-[rgba(204,85,0,1)] text-white font-semibold px-6"
            >
              <Play className="h-4 w-4 mr-2" /> Start Round ({tracks.length} tracks)
            </Button>
          )}
        </div>

        {/* Round Configuration */}
        <div className="px-4 pt-3 pb-2">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-card-foreground">Round Configuration</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid grid-cols-4 gap-4 mb-3">
                <div>
                  <label className="text-xs text-muted-foreground flex items-center justify-between mb-2">
                    Clip Length <span className="font-mono">{clipLength}s</span>
                  </label>
                  <Slider value={[clipLength]} onValueChange={(v) => setClipLength(v[0])} min={2} max={25} step={1} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center justify-between mb-2">
                    Base Points <span className="font-mono">{basePoints}</span>
                  </label>
                  <Slider value={[basePoints]} onValueChange={(v) => setBasePoints(v[0])} min={1} max={10} step={1} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center justify-between mb-2">
                    Speed Bonus <span className="font-mono">{speedBonus}</span>
                  </label>
                  <Slider value={[speedBonus]} onValueChange={(v) => setSpeedBonus(v[0])} min={0} max={10} step={1} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center justify-between mb-2">
                    <Volume2 className="h-3 w-3 inline" /> Volume <span className="font-mono">{masterVolume}%</span>
                  </label>
                  <Slider value={[masterVolume]} onValueChange={(v) => setMasterVolumeState(v[0])} min={0} max={100} step={1} />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={eliminationEnabled} onCheckedChange={setEliminationEnabled} />
                  <span className="text-xs text-card-foreground">Elimination Mode</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={evilMode} onCheckedChange={setEvilMode} />
                  <span className="text-xs text-card-foreground flex items-center gap-1">
                    <Skull className="h-3 w-3" /> Evil Mode
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={punishmentMode} onCheckedChange={setPunishmentMode} />
                  <span className="text-xs text-card-foreground">Punishment Mode</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={reversedEnabled} onCheckedChange={setReversedEnabled} />
                  <span className="text-xs text-card-foreground flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" /> Play Backwards
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two-column grid: Folder browser + Tracks (fills remaining space) */}
        <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4 grid grid-cols-2 grid-rows-[1fr] gap-4">
          {/* Left: Folder browser */}
          <Card className="bg-card border-border flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
              <CardTitle className="text-sm font-semibold text-card-foreground">Select a folder</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex-1 min-h-0 flex flex-col">
              <div className="text-xs text-muted-foreground mb-2 font-mono flex-shrink-0">
                {rootPath ? "/PopQuiz/Music Rounds/" : "/Music Rounds/"}
              </div>
              <div className="flex items-center gap-3 mb-3 flex-shrink-0">
                <span className="text-xs font-medium text-muted-foreground">Order by</span>
                {(["name", "newest", "oldest"] as SortOrder[]).map((order) => (
                  <label key={order} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="sort"
                      checked={sortOrder === order}
                      onChange={() => setSortOrder(order)}
                      className="accent-primary w-3 h-3"
                    />
                    <span className="text-xs text-card-foreground capitalize">{order}</span>
                  </label>
                ))}
              </div>
              <div className="border border-border rounded bg-background flex-1 min-h-0 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading...</div>
                ) : error ? (
                  <div className="flex items-center justify-center h-full text-destructive text-sm">{error}</div>
                ) : sortedFolders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
                    <Folder className="h-8 w-8 opacity-40" />
                    <span>No folders found</span>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {sortedFolders.map((folder) => (
                      <button
                        key={folder.path}
                        onClick={() => setSelectedFolder(folder)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                          selectedFolder?.path === folder.path ? "bg-accent text-accent-foreground" : "text-card-foreground"
                        }`}
                      >
                        {selectedFolder?.path === folder.path ? (
                          <FolderOpen className="h-4 w-4 text-[rgba(255,127,39,1)] flex-shrink-0" />
                        ) : (
                          <Folder className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        )}
                        <span className="truncate">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: Track list (read-only in setup) */}
          <Card className="bg-card border-border flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-card-foreground">
                  Tracks {tracks.length > 0 && <Badge variant="secondary" className="ml-2">{tracks.length} / 18</Badge>}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex-1 min-h-0 flex flex-col">
              <div className="border border-border rounded bg-background flex-1 min-h-0 overflow-y-auto">
                {tracks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-1">
                    <FileAudio className="h-6 w-6 opacity-40" />
                    <span>Select a folder to load tracks</span>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {tracks.map((track, index) => (
                      <div
                        key={track.path}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm text-card-foreground"
                      >
                        <span className="text-xs text-muted-foreground w-5 text-right">{index + 1}.</span>
                        <FileAudio className="h-3.5 w-3.5 text-[rgba(255,127,39,1)] flex-shrink-0" />
                        <span className="truncate flex-1 text-xs">{track.name.replace(/\.[^/.]+$/, '')}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handlePreviewTrack(track)}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- Render Gameplay Phase ---
  const validBuzzes = buzzes.filter((b) => b.valid).sort((a, b) => (a.responseTime ?? 0) - (b.responseTime ?? 0));
  const invalidBuzzes = buzzes.filter((b) => !b.valid);

  // --- Render center panel based on gameplay step ---
  const renderCenterPanel = () => {
    switch (gameplayStep) {
      case "target-selection":
        return (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Select a target clip first
          </div>
        );

      case "playlist-ready":
        return (
          <div className="space-y-3">
            {/* Playback sequence - draggable */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Playlist Order</span>
              <Button onClick={shufflePlaybackSequence} variant="ghost" size="sm" className="h-6 px-2 text-xs">
                <Shuffle className="h-3 w-3 mr-1" /> Shuffle
              </Button>
            </div>
            <div className="border border-border rounded bg-background max-h-[180px] overflow-y-auto">
              {playbackSequence.map((clip, idx) => {
                const isTarget = clip.id === targetClip?.id;
                return (
                  <div
                    key={`${clip.id}-${idx}`}
                    draggable
                    onDragStart={() => handleSeqDragStart(idx)}
                    onDragOver={(e) => handleSeqDragOver(e, idx)}
                    onDragEnd={handleSeqDragEnd}
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs border-b border-border last:border-b-0 cursor-grab active:cursor-grabbing ${
                      seqDragIndex === idx ? "bg-accent/50" : ""
                    }`}
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="w-4 text-muted-foreground text-right">{idx + 1}</span>
                    <span className={`truncate flex-1 ${isTarget ? "text-green-400 font-semibold" : "text-card-foreground"}`}>
                      {clip.name}
                    </span>
                    {isTarget && <Target className="h-3 w-3 text-green-500" />}
                  </div>
                );
              })}
            </div>

            {/* Controls */}
            <Button onClick={startPlayback} className="w-full bg-green-600 hover:bg-green-700 text-white" size="sm">
              <Play className="h-4 w-4 mr-1" /> Play Music
            </Button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <Volume2 className="h-3 w-3 text-muted-foreground" />
              <Slider value={[masterVolume]} onValueChange={(v) => handleVolumeChange(v[0])} min={0} max={100} step={1} className="flex-1" />
              <span className="text-xs text-muted-foreground w-8">{masterVolume}%</span>
            </div>
          </div>
        );

      case "playing":
        return (
          <div className="space-y-3">
            {/* Playback sequence */}
            <div className="border border-border rounded bg-background max-h-[180px] overflow-y-auto">
              {playbackSequence.map((clip, idx) => {
                const isPlaying = currentPlayingIndex === idx;
                const isTarget = clip.id === targetClip?.id;
                return (
                  <div
                    key={`${clip.id}-${idx}`}
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs border-b border-border last:border-b-0 ${
                      isPlaying ? "bg-[rgba(255,127,39,0.15)]" : ""
                    }`}
                  >
                    <span className="w-4 text-muted-foreground text-right">{idx + 1}</span>
                    {isPlaying && <Play className="h-3 w-3 text-[rgba(255,127,39,1)] animate-pulse" />}
                    <span className={`truncate flex-1 ${isTarget ? "text-green-400 font-semibold" : "text-card-foreground"}`}>
                      {clip.name}
                    </span>
                    {isTarget && <Target className="h-3 w-3 text-green-500" />}
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            {isPlaybackActive && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Clip {currentPlayingIndex + 1} of {playbackSequence.length}</span>
                  <span>{currentPlayingClipId === targetClip?.id ? "TARGET PLAYING" : ""}</span>
                </div>
                <Progress value={clipProgress} className="h-2" />
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-2">
              <Button onClick={skipClip} variant="outline" size="sm" className="flex-1">
                <SkipForward className="h-4 w-4 mr-1" /> Skip
              </Button>
              <Button onClick={() => { stopPlayback(); setGameplayStep("reveal-answer"); }} variant="destructive" size="sm">
                <Square className="h-4 w-4 mr-1" /> Stop
              </Button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <Volume2 className="h-3 w-3 text-muted-foreground" />
              <Slider value={[masterVolume]} onValueChange={(v) => handleVolumeChange(v[0])} min={0} max={100} step={1} className="flex-1" />
              <span className="text-xs text-muted-foreground w-8">{masterVolume}%</span>
            </div>
          </div>
        );

      case "reveal-answer":
        return (
          <div className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center">
              <Music className="h-8 w-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-card-foreground mb-1">Music Stopped</p>
              <p className="text-xs text-muted-foreground">
                The target clip has been played. Ready to reveal the answer?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {validBuzzes.length} correct buzz{validBuzzes.length !== 1 ? "es" : ""}, {invalidBuzzes.length} wrong
              </p>
            </div>
            <Button
              onClick={handleRevealAnswer}
              className="w-full bg-[rgba(255,127,39,1)] hover:bg-[rgba(204,85,0,1)] text-white font-semibold"
              size="lg"
            >
              <Eye className="h-5 w-5 mr-2" /> Reveal Answer
            </Button>
          </div>
        );

      case "fastest-team":
        return (
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
              <Check className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">The answer was:</p>
              <p className="text-xl font-bold text-green-400">{targetClip?.name}</p>
            </div>
            {validBuzzes.length > 0 ? (
              <Button
                onClick={handleShowFastestTeam}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                size="lg"
              >
                <Award className="h-5 w-5 mr-2" /> Show Fastest Team
              </Button>
            ) : (
              <Button
                onClick={() => setGameplayStep("next-round")}
                className="w-full bg-[rgba(255,127,39,1)] hover:bg-[rgba(204,85,0,1)] text-white font-semibold"
                size="lg"
              >
                <ChevronRight className="h-5 w-5 mr-2" /> Next
              </Button>
            )}
          </div>
        );

      case "next-round":
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
              <Trophy className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-card-foreground">Round Complete</p>
              <p className="text-xs text-muted-foreground mt-1">
                {validBuzzes.length} correct buzz{validBuzzes.length !== 1 ? "es" : ""}, {invalidBuzzes.length} wrong
              </p>
            </div>
            <Button
              onClick={roundComplete ? handleEndRound : handleNextTarget}
              className="w-full bg-[rgba(255,127,39,1)] hover:bg-[rgba(204,85,0,1)] text-white"
            >
              {roundComplete ? "End Round" : "Next Target"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Music className="h-5 w-5 text-[rgba(255,127,39,1)]" />
          <h2 className="text-lg font-semibold text-card-foreground">Music Round</h2>
          <Badge variant="secondary">{remainingClips.length} clips remaining</Badge>
          {reversedEnabled && (
            <Badge variant="outline" className="text-amber-400 border-amber-400/30">
              <RotateCcw className="h-3 w-3 mr-1" /> Reversed
            </Badge>
          )}
        </div>
        <Button onClick={handleEndRound} variant="outline" size="sm">
          End Round
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Left: Target selection / Remaining clips */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-card-foreground">
                  {gameplayStep === "target-selection" ? "Select Target Clip" : "Target Selected"}
                </CardTitle>
                {gameplayStep === "target-selection" && remainingClips.length > 0 && (
                  <Button onClick={selectRandomTarget} variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    <Shuffle className="h-3 w-3 mr-1" /> Random
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {gameplayStep !== "target-selection" && targetClip ? (
                <div className="space-y-3">
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-semibold text-green-400">Target:</span>
                    </div>
                    <span className="text-lg font-bold text-card-foreground">{targetClip.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Announce to players: "Buzz when you hear <strong>{targetClip.name}</strong>"
                  </p>
                  {gameplayStep === "playlist-ready" && (
                    <Button
                      onClick={() => {
                        setTargetClip(null);
                        targetClipIdRef.current = "";
                        setPlaybackSequence([]);
                        setGameplayStep("target-selection");
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                    >
                      Change Target
                    </Button>
                  )}
                </div>
              ) : (
                <div className="border border-border rounded bg-background max-h-[300px] overflow-y-auto">
                  {remainingClips.length === 0 ? (
                    <div className="flex items-center justify-center h-[100px] text-muted-foreground text-sm">
                      No clips remaining
                    </div>
                  ) : (
                    remainingClips.map((clip) => (
                      <button
                        key={clip.id}
                        onClick={() => selectTarget(clip)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-b border-border last:border-b-0"
                      >
                        <FileAudio className="h-3.5 w-3.5 text-[rgba(255,127,39,1)] flex-shrink-0" />
                        <span className="truncate text-card-foreground">{clip.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Center: Playback control */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-card-foreground">Playback</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {renderCenterPanel()}
            </CardContent>
          </Card>

          {/* Right: Buzz tracking */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" /> Buzzes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {buzzes.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                  {isPlaybackActive ? "Waiting for buzzes..." : "No buzzes yet"}
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {/* Valid buzzes first */}
                  {validBuzzes.map((buzz, idx) => (
                    <div key={`valid-${buzz.teamId}`} className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs">
                      <Badge variant="secondary" className="bg-green-600 text-white text-[10px] px-1.5">
                        #{idx + 1}
                      </Badge>
                      <Check className="h-3 w-3 text-green-500" />
                      <span className="font-semibold text-card-foreground">{buzz.teamName}</span>
                      <span className="text-muted-foreground ml-auto">
                        {buzz.responseTime ? `${(buzz.responseTime / 1000).toFixed(2)}s` : ""}
                      </span>
                    </div>
                  ))}
                  {/* Invalid buzzes */}
                  {invalidBuzzes.map((buzz) => (
                    <div key={`invalid-${buzz.teamId}`} className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs">
                      <X className="h-3 w-3 text-red-500" />
                      <span className="font-semibold text-card-foreground">{buzz.teamName}</span>
                      <span className="text-red-400 ml-auto">Wrong clip</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
