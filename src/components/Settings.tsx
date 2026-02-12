import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Slider } from "./ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { audioStorage, StoredAudio } from "../utils/audioStorage";
import { useSettings } from "../utils/SettingsContext";
import { 
  X, 
  Settings as SettingsIcon, 
  Volume2, 
  Users, 
  Monitor, 
  Wifi, 
  Download, 
  Wrench, 
  Bug,
  Save,
  RotateCcw,
  Upload,
  Play,
  Pause,
  VolumeX,
  Speaker,
  Headphones,
  Globe,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  WifiOff,
  Trash2,
  Music,
  Activity,
  Timer,
  Camera,
  Palette,
  Skull
} from "lucide-react";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 
  | "general" 
  | "sounds" 
  | "style-themes"
  | "waiting-room" 
  | "external-screen" 
  | "network-wifi" 
  | "updates" 
  | "advanced-features" 
  | "bug-report";

// Keypad Preview Component
interface KeypadPreviewProps {
  design: string;
}

function KeypadPreview({ design }: KeypadPreviewProps) {
  const [selectedAnswer, setSelectedAnswer] = useState("B");
  
  // Keypad design configurations (matching KeypadInterface)
  const keypadDesigns = {
    "neon-glow": {
      name: "Neon Glow",
      containerClass: "bg-gray-900 p-3 rounded-xl border-2 border-cyan-400 shadow-lg shadow-cyan-400/30",
      gridClass: "grid grid-cols-4 gap-2",
      buttonSize: "h-12 w-12",
      buttonText: "text-sm",
      selectedStyle: "bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg ring-2 ring-pink-400/50 shadow-pink-500/50",
      unselectedStyle: "bg-gradient-to-br from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white border-2 border-cyan-300 shadow-lg shadow-cyan-400/30"
    },
    "gaming-beast": {
      name: "Gaming Beast",
      containerClass: "bg-gradient-to-br from-gray-800 to-black p-3 rounded-lg border-2 border-red-500 shadow-lg shadow-red-500/30",
      gridClass: "grid grid-cols-4 gap-2",
      buttonSize: "h-12 w-12",
      buttonText: "text-sm",
      selectedStyle: "bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white shadow-lg ring-2 ring-red-400/70 shadow-red-500/50",
      unselectedStyle: "bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 text-red-400 border border-red-500/50 shadow-md"
    },
    "matrix-green": {
      name: "Matrix Green",
      containerClass: "bg-black p-2 rounded-md border-2 border-green-400 shadow-lg shadow-green-400/20",
      gridClass: "grid grid-cols-4 gap-1.5",
      buttonSize: "h-12 w-12",
      buttonText: "text-sm font-mono",
      selectedStyle: "bg-green-400 hover:bg-green-300 text-black shadow-lg ring-2 ring-green-400/70 shadow-green-400/50",
      unselectedStyle: "bg-gray-900 hover:bg-gray-800 text-green-400 border border-green-400/50 shadow-md shadow-green-400/20"
    },
    "bubble-pop": {
      name: "Bubble Pop",
      containerClass: "bg-gradient-to-br from-pink-200 to-purple-200 p-3 rounded-2xl border-4 border-white shadow-lg",
      gridClass: "grid grid-cols-4 gap-2",
      buttonSize: "h-12 w-12",
      buttonText: "text-sm",
      selectedStyle: "bg-gradient-to-br from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 text-white shadow-lg ring-4 ring-orange-300/60 scale-110",
      unselectedStyle: "bg-gradient-to-br from-white to-gray-100 hover:from-gray-50 hover:to-gray-200 text-purple-600 border-2 border-purple-300 shadow-lg"
    },
    "ocean-wave": {
      name: "Ocean Wave",
      containerClass: "bg-gradient-to-br from-blue-400 to-teal-500 p-3 rounded-xl border-3 border-white shadow-lg",
      gridClass: "grid grid-cols-4 gap-2",
      buttonSize: "h-12 w-12",
      buttonText: "text-sm",
      selectedStyle: "bg-gradient-to-br from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white shadow-lg ring-3 ring-yellow-300/70",
      unselectedStyle: "bg-gradient-to-br from-white to-blue-100 hover:from-blue-50 hover:to-blue-200 text-blue-800 border-2 border-blue-300 shadow-md"
    },
    "cyber-chrome": {
      name: "Cyber Chrome",
      containerClass: "bg-gradient-to-br from-gray-300 to-gray-500 p-2 rounded-lg border-2 border-gray-600 shadow-lg",
      gridClass: "grid grid-cols-4 gap-1.5",
      buttonSize: "h-12 w-12",
      buttonText: "text-sm",
      selectedStyle: "bg-gradient-to-br from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 text-white shadow-lg ring-2 ring-blue-300/70",
      unselectedStyle: "bg-gradient-to-br from-gray-100 to-gray-200 hover:from-white hover:to-gray-100 text-gray-800 border border-gray-400 shadow-md"
    },
    "fire-storm": {
      name: "Fire Storm",
      containerClass: "bg-gradient-to-br from-red-800 to-orange-900 p-3 rounded-xl border-3 border-yellow-400 shadow-lg shadow-orange-500/40",
      gridClass: "grid grid-cols-4 gap-2",
      buttonSize: "h-12 w-12",
      buttonText: "text-sm",
      selectedStyle: "bg-gradient-to-br from-yellow-300 to-orange-400 hover:from-yellow-400 hover:to-orange-500 text-red-800 shadow-lg ring-3 ring-yellow-400/80",
      unselectedStyle: "bg-gradient-to-br from-red-600 to-orange-700 hover:from-red-500 hover:to-orange-600 text-yellow-200 border-2 border-yellow-400/50 shadow-md"
    },
    "cosmic-space": {
      name: "Cosmic Space",
      containerClass: "bg-gradient-to-br from-purple-900 to-indigo-900 p-3 rounded-2xl border-2 border-purple-400 shadow-lg shadow-purple-500/30",
      gridClass: "grid grid-cols-4 gap-2",
      buttonSize: "h-12 w-12",
      buttonText: "text-sm",
      selectedStyle: "bg-gradient-to-br from-cyan-300 to-blue-400 hover:from-cyan-400 hover:to-blue-500 text-purple-900 shadow-lg ring-3 ring-cyan-300/70 shadow-cyan-400/50",
      unselectedStyle: "bg-gradient-to-br from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 text-cyan-200 border border-purple-400/50 shadow-md shadow-purple-400/20"
    }
  };

  const currentDesign = keypadDesigns[design] || keypadDesigns["neon-glow"];
  const answers = ["A", "B", "C", "D"];

  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="text-xs text-muted-foreground">Click to test interactions</div>
      <div className={currentDesign.containerClass}>
        <div className={currentDesign.gridClass}>
          {answers.map((answer) => (
            <button
              key={answer}
              onClick={() => setSelectedAnswer(answer)}
              className={`
                ${currentDesign.buttonSize} 
                ${currentDesign.buttonText}
                flex items-center justify-center font-bold rounded-lg transition-all duration-200 transform active:scale-95
                ${selectedAnswer === answer ? currentDesign.selectedStyle : currentDesign.unselectedStyle}
              `}
            >
              {answer}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Selected: <span className="font-mono text-foreground">{selectedAnswer}</span>
      </div>
    </div>
  );
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const { version, updateResponseTimesEnabled, updateTeamPhotosAutoApprove, updateGameModePoints, updateGameModeTimer, updateCountdownStyle, updateVoiceCountdown, updateKeypadDesign, updateEvilModeEnabled, updatePunishmentEnabled } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // Audio management state
  const [countdownAudios, setCountdownAudios] = useState<StoredAudio[]>([]);
  const [selectedCountdownAudio, setSelectedCountdownAudio] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<string | null>(null);

  // Load countdown audio files on component mount
  useEffect(() => {
    const loadAudios = async () => {
      try {
        const audios = await audioStorage.getAudioByType('countdown');
        setCountdownAudios(audios);
      } catch (error) {
        console.error('Failed to load audio files:', error);
      }
    };
    loadAudios();
  }, []);

  // Settings state - load from localStorage or use defaults
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem('quizHostSettings');
    const defaultSettings = {
      // General settings
      theme: "dark",
      language: "en",
      timezone: "auto",
      autoSave: true,
      confirmActions: true,
      
      // Default scores settings
      defaultPoints: 4,
      defaultSpeedBonus: 2,
      gameModePoints: {
        keypad: 4,
        buzzin: 4,
        nearestwins: 30,
        wheelspinner: 4
      },
      gameModeTimers: {
        keypad: 30,
        buzzin: 30,
        nearestwins: 10
      },
      nearestWinsTimer: 10,
    
    // Sound settings
    masterVolume: [80],
    soundEffects: true,
    voiceCountdown: true,
    backgroundMusic: false,
    clickSounds: true,
    notificationSounds: true,
    countdownVoice: "female",
    
    // Waiting room settings
    showWaitingRoom: true,
    allowLateJoin: true,
    enableScanningIn: false,  // Teams can connect but must be scanned in by host
    maxParticipants: 50,
    waitingRoomMessage: "Welcome to the quiz! Please wait for the host to start.",
    showParticipantCount: true,
    
    // External screen settings
    displayResolution: "1920x1080",
    fullscreenMode: true,
    screenSaver: false,
    screenSaverDelay: [5],
    countdownStyle: "circular",
    keypadDesign: "neon-glow",
    
    // Network & WiFi settings
    networkMode: "local",
    wifiSSID: "",
    wifiPassword: "",
    portNumber: 8080,
    allowExternalConnections: false,
    playerDeviceStatus: false,  // New toggle for player device status
    playerDeviceResponseTime: false,  // New toggle for player device response time
    wifiNetworkStyle: "stable",  // New selector: "stable" or "experimental"
    
    // Updates settings
    autoUpdate: true,
    betaUpdates: false,
    updateChannel: "stable",
    licenseKey: "",  // New license key for beta access
    selectedVersion: "stable-25.9.20",  // New version selection
    licenseKeyValid: false,  // Track if license key is valid
    
    // Advanced Features settings
    responseTimesEnabled: true,  // Response times display setting (enabled by default for testing)
    staggeredEnabled: false,  // Staggered speed bonus mode
    featureToggle1: false,  // Feature toggle 1 - to be labeled later
    featureToggle2: false,  // Feature toggle 2 - to be labeled later
    featureToggle3: false,  // Feature toggle 3 - to be labeled later
    featureToggle4: false,  // Feature toggle 4 - to be labeled later
    };
    
    if (savedSettings) {
      try {
        return { ...defaultSettings, ...JSON.parse(savedSettings) };
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
        return defaultSettings;
      }
    }
    
    return defaultSettings;
  });

  const tabs = [
    { id: "general", label: "General", icon: SettingsIcon },
    { id: "sounds", label: "Sounds", icon: Volume2 },
    { id: "style-themes", label: "Style & Themes", icon: Palette },
    { id: "waiting-room", label: "Waiting Room", icon: Users },
    { id: "external-screen", label: "External Screen", icon: Monitor },
    { id: "network-wifi", label: "Network & WiFi", icon: Wifi },
    { id: "updates", label: "Updates", icon: Download },
    { id: "advanced-features", label: "Advanced Features", icon: Wrench },
    { id: "bug-report", label: "Bug Report", icon: Bug },
  ] as const;

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
    
    // Handle immediate setting updates that need to be reflected in the context
    if (key === "theme") {
      applyTheme(value);
    } else if (key === "responseTimesEnabled") {
      updateResponseTimesEnabled(value);
    } else if (key === "teamPhotosAutoApprove") {
      updateTeamPhotosAutoApprove(value);
    } else if (key === "countdownStyle") {
      console.log('Settings: Updating countdown style via updateSetting:', value);
      updateCountdownStyle(value);
    } else if (key === "voiceCountdown") {
      updateVoiceCountdown(value);
    } else if (key === "evilModeEnabled") {
      updateEvilModeEnabled(value);
    } else if (key === "punishmentEnabled") {
      updatePunishmentEnabled(value);
    }
  };

  const applyTheme = (theme: string) => {
    const htmlElement = document.documentElement;
    
    if (theme === "dark") {
      htmlElement.classList.add("dark");
    } else {
      htmlElement.classList.remove("dark");
    }
  };

  // Apply theme on component mount
  useEffect(() => {
    applyTheme(settings.theme);
  }, []); // Only run on mount

  // Audio management functions
  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingAudio(true);
    try {
      const storedAudio = await audioStorage.storeAudio(file, 'countdown');
      setCountdownAudios(prev => [...prev, storedAudio]);
      setHasUnsavedChanges(true);
      
      // Auto-select the uploaded audio if it's the first one
      if (countdownAudios.length === 0) {
        setSelectedCountdownAudio(storedAudio.id);
        updateSetting("countdownVoice", "custom");
      }
    } catch (error) {
      console.error('Failed to upload audio:', error);
      alert('Failed to upload audio file. Please try again.');
    } finally {
      setIsUploadingAudio(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handlePlayAudio = async (audioId: string) => {
    const audio = countdownAudios.find(a => a.id === audioId);
    if (!audio) return;

    if (isPlayingAudio === audioId) {
      setIsPlayingAudio(null);
      return;
    }

    try {
      setIsPlayingAudio(audioId);
      const volume = settings.masterVolume[0] / 100;
      await audioStorage.playAudio(audio.url, volume);
    } catch (error) {
      console.error('Failed to play audio:', error);
    } finally {
      setIsPlayingAudio(null);
    }
  };

  const handleDeleteAudio = async (audioId: string) => {
    if (confirm('Are you sure you want to delete this audio file?')) {
      try {
        await audioStorage.deleteAudio(audioId);
        setCountdownAudios(prev => prev.filter(audio => audio.id !== audioId));
        
        // If the deleted audio was selected, reset to default
        if (selectedCountdownAudio === audioId) {
          setSelectedCountdownAudio(null);
          updateSetting("countdownVoice", "female");
        }
        
        setHasUnsavedChanges(true);
      } catch (error) {
        console.error('Failed to delete audio:', error);
        alert('Failed to delete audio file. Please try again.');
      }
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem('quizHostSettings', JSON.stringify(settings));
      console.log("Settings saved successfully:", settings);
      setHasUnsavedChanges(false);
      
      // Dispatch custom event to notify other components of settings update
      window.dispatchEvent(new CustomEvent('settingsUpdated'));
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  const handleReset = () => {
    // Reset to defaults
    setHasUnsavedChanges(true);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmClose(false);
    onClose();
    setHasUnsavedChanges(false);
  };

  const handleCancelClose = () => {
    setShowConfirmClose(false);
  };

  // License key validation function
  const validateLicenseKey = (key: string): boolean => {
    // Simple validation - you can make this more sophisticated
    const validKeys = [
      "BETA-ACCESS-2024", 
      "EARLY-ACCESS-KEY",
      "DEV-PREVIEW-UNLOCK"
    ];
    return validKeys.includes(key.toUpperCase());
  };

  // Handle license key change
  const handleLicenseKeyChange = (key: string) => {
    const isValid = validateLicenseKey(key);
    updateSetting("licenseKey", key);
    updateSetting("licenseKeyValid", isValid);
    
    // If key becomes invalid, reset to stable version
    if (!isValid && settings.selectedVersion.includes("early-access")) {
      updateSetting("selectedVersion", "stable-25.9.20");
    }
  };

  // Get available versions based on license status
  const getAvailableVersions = () => {
    const stableVersions = [
      { value: "stable-25.9.12", label: "Stable 25.9.12" },
      { value: "stable-25.9.15", label: "Stable 25.9.15" },
      { value: "stable-25.9.18", label: "Stable 25.9.18" },
      { value: "stable-25.9.20", label: "Stable 25.9.20 (Latest)" },
    ];

    const betaVersions = [
      { value: "early-access-25.10.1", label: "Early Access 25.10.1" },
      { value: "early-access-25.10.3", label: "Early Access 25.10.3" },
      { value: "early-access-26.0.0", label: "Early Access 26.0.0 (Preview)" },
    ];

    return settings.licenseKeyValid ? [...stableVersions, ...betaVersions] : stableVersions;
  };

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Application Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <Label className="text-foreground font-medium">Application Version</Label>
              <p className="text-sm text-muted-foreground mt-1">Current version of the quiz hosting software</p>
            </div>
            <Badge variant="secondary" className="font-mono text-sm">
              {version}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Basic Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="language" className="text-foreground mb-2 block">Language</Label>
              <Select value={settings.language} onValueChange={(value) => updateSetting("language", value)}>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish (Coming Soon)</SelectItem>
                  <SelectItem value="fr">French (Coming Soon)</SelectItem>
                  <SelectItem value="de">German (Coming Soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="theme" className="text-foreground mb-2 block">Theme</Label>
              <Select value={settings.theme} onValueChange={(value) => updateSetting("theme", value)}>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>


        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Default Scores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> These values will be the default starting points when you open each game mode interface. 
              You can still adjust the values during each round without affecting these default settings.
            </p>
          </div>
          
          {/* Keypad Mode Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <h4 className="font-semibold text-foreground">Keypad Mode</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-foreground flex items-center justify-between mb-3">
                  Points
                  <span className="text-muted-foreground">{settings.defaultPoints}</span>
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Default points awarded for each correct answer
                </p>
                <Slider
                  value={[settings.defaultPoints]}
                  onValueChange={(value) => updateSetting("defaultPoints", value[0])}
                  max={10}
                  min={0}
                  step={1}
                  className="w-full"
                />
              </div>
              
              <div>
                <Label className="text-foreground flex items-center justify-between mb-3">
                  Speed Bonus
                  <span className="text-muted-foreground">{settings.defaultSpeedBonus}</span>
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Default bonus points for fastest correct answers
                </p>
                <Slider
                  value={[settings.defaultSpeedBonus]}
                  onValueChange={(value) => updateSetting("defaultSpeedBonus", value[0])}
                  max={10}
                  min={0}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-foreground flex items-center justify-between mb-3">
                <span className="flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  Timer Length
                </span>
                <span className="text-muted-foreground">{settings.gameModeTimers?.keypad || 30}s</span>
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Default countdown timer duration for keypad questions
              </p>
              <Slider
                value={[settings.gameModeTimers?.keypad || 30]}
                onValueChange={(value) => {
                  const newGameModeTimers = { ...(settings.gameModeTimers || { keypad: 30, buzzin: 30, nearestwins: 10 }) };
                  newGameModeTimers.keypad = value[0];
                  updateSetting("gameModeTimers", newGameModeTimers);
                  updateGameModeTimer('keypad', value[0]);
                }}
                max={30}
                min={5}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Buzz-in Mode Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <h4 className="font-semibold text-foreground">Buzz-in Mode</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-foreground flex items-center justify-between mb-3">
                  Points
                  <span className="text-muted-foreground">{settings.gameModePoints?.buzzin || 4}</span>
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Default points awarded for correct answers in buzz-in mode
                </p>
                <Slider
                  value={[settings.gameModePoints?.buzzin || 4]}
                  onValueChange={(value) => {
                    const newGameModePoints = { ...(settings.gameModePoints || { keypad: 4, buzzin: 4, nearestwins: 4, wheelspinner: 4 }) };
                    newGameModePoints.buzzin = value[0];
                    updateSetting("gameModePoints", newGameModePoints);
                    // Also update the SettingsContext immediately
                    updateGameModePoints('buzzin', value[0]);
                  }}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
              
              <div>
                <Label className="text-foreground flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2">
                    <Timer className="w-4 h-4" />
                    Timer Length
                  </span>
                  <span className="text-muted-foreground">{settings.gameModeTimers?.buzzin || 30}s</span>
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Default answer timer after buzzing in
                </p>
                <Slider
                  value={[settings.gameModeTimers?.buzzin || 30]}
                  onValueChange={(value) => {
                    const newGameModeTimers = { ...(settings.gameModeTimers || { keypad: 30, buzzin: 30, nearestwins: 10 }) };
                    newGameModeTimers.buzzin = value[0];
                    updateSetting("gameModeTimers", newGameModeTimers);
                    updateGameModeTimer('buzzin', value[0]);
                  }}
                  max={30}
                  min={5}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Nearest Wins Mode Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <h4 className="font-semibold text-foreground">Nearest Wins Mode</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-foreground flex items-center justify-between mb-3">
                  Winner Points
                  <span className="text-muted-foreground">{settings.gameModePoints?.nearestwins || 4}</span>
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Default points awarded to the team with the closest guess
                </p>
                <Slider
                  value={[settings.gameModePoints?.nearestwins || 4]}
                  onValueChange={(value) => {
                    const newGameModePoints = { ...(settings.gameModePoints || { keypad: 4, buzzin: 4, nearestwins: 4, wheelspinner: 4 }) };
                    newGameModePoints.nearestwins = value[0];
                    updateSetting("gameModePoints", newGameModePoints);
                    // Also update the SettingsContext immediately
                    updateGameModePoints('nearestwins', value[0]);
                  }}
                  max={100}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
              
              <div>
                <Label className="text-foreground flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2">
                    <Timer className="w-4 h-4" />
                    Timer Length
                  </span>
                  <span className="text-muted-foreground">{settings.gameModeTimers?.nearestwins || 10}s</span>
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Default countdown timer for submitting guesses
                </p>
                <Slider
                  value={[settings.gameModeTimers?.nearestwins || 10]}
                  onValueChange={(value) => {
                    const newGameModeTimers = { ...(settings.gameModeTimers || { keypad: 30, buzzin: 30, nearestwins: 10 }) };
                    newGameModeTimers.nearestwins = value[0];
                    updateSetting("gameModeTimers", newGameModeTimers);
                    updateGameModeTimer('nearestwins', value[0]);
                  }}
                  max={30}
                  min={5}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSoundsSettings = () => (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Audio Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-foreground flex items-center justify-between mb-3">
              Master Volume
              <span className="text-muted-foreground">{settings.masterVolume[0]}%</span>
            </Label>
            <Slider
              value={settings.masterVolume}
              onValueChange={(value) => updateSetting("masterVolume", value)}
              max={100}
              min={0}
              step={1}
              className="w-full"
            />
          </div>

          {/* Additional Volume Sliders */}
          <div className="space-y-4">
            <div>
              <Label className="text-foreground flex items-center justify-between mb-3">
                Team Buzzers
                <span className="text-muted-foreground">{settings.teamBuzzersVolume?.[0] || 50}%</span>
              </Label>
              <Slider
                value={settings.teamBuzzersVolume || [50]}
                onValueChange={(value) => updateSetting("teamBuzzersVolume", value)}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-foreground flex items-center justify-between mb-3">
                Count Down Timer
                <span className="text-muted-foreground">{settings.countDownTimerVolume?.[0] || 50}%</span>
              </Label>
              <Slider
                value={settings.countDownTimerVolume || [50]}
                onValueChange={(value) => updateSetting("countDownTimerVolume", value)}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-foreground flex items-center justify-between mb-3">
                Round Begin
                <span className="text-muted-foreground">{settings.roundBeginVolume?.[0] || 50}%</span>
              </Label>
              <Slider
                value={settings.roundBeginVolume || [50]}
                onValueChange={(value) => updateSetting("roundBeginVolume", value)}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-foreground flex items-center justify-between mb-3">
                Applause
                <span className="text-muted-foreground">{settings.celebrationVolume?.[0] || 50}%</span>
              </Label>
              <Slider
                value={settings.celebrationVolume || [50]}
                onValueChange={(value) => updateSetting("celebrationVolume", value)}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-foreground flex items-center justify-between mb-3">
                Misc
                <span className="text-muted-foreground">{settings.miscVolume?.[0] || 50}%</span>
              </Label>
              <Slider
                value={settings.miscVolume || [50]}
                onValueChange={(value) => updateSetting("miscVolume", value)}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Sound Theme Selection */}
          <div>
            <Label htmlFor="sound-theme" className="text-foreground">Sound Theme</Label>
            <Select value={settings.soundTheme || "Gameshow"} onValueChange={(value) => updateSetting("soundTheme", value)}>
              <SelectTrigger className="bg-input border-border text-foreground mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Gameshow">Gameshow</SelectItem>
                <SelectItem value="Intense">Intense</SelectItem>
                <SelectItem value="Wacky">Wacky</SelectItem>
                <SelectItem value="Musical">Musical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-border" />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-foreground flex items-center gap-2">
                <Speaker className="w-4 h-4" />
                Sound Effects
              </Label>
              <Switch
                checked={settings.soundEffects}
                onCheckedChange={(checked) => updateSetting("soundEffects", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-foreground flex items-center gap-2">
                <Headphones className="w-4 h-4" />
                Voice Countdown
              </Label>
              <Switch
                checked={settings.voiceCountdown}
                onCheckedChange={(checked) => updateSetting("voiceCountdown", checked)}
              />
            </div>
          </div>

          <Separator className="bg-border" />
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
            <Label className="text-foreground">Select buzzers folder</Label>
            <Button variant="outline" className="ml-4">
              Select Folder
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStyleThemesSettings = () => (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Keypad Design Styles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              <strong>Choose your keypad style!</strong> Select from various visual themes for the keypad interface used in questions. Each design offers a unique look and feel while maintaining full functionality.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-foreground mb-3 block">Keypad Design Theme</Label>
              <Select 
                value={settings.keypadDesign || "neon-glow"} 
                onValueChange={(value) => {
                  updateSetting("keypadDesign", value);
                  updateKeypadDesign(value as any);
                }}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Select keypad design" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neon-glow">🌟 Neon Glow (Default)</SelectItem>
                  <SelectItem value="gaming-beast">🎮 Gaming Beast</SelectItem>
                  <SelectItem value="matrix-green">🔋 Matrix Green</SelectItem>
                  <SelectItem value="bubble-pop">🫧 Bubble Pop</SelectItem>
                  <SelectItem value="ocean-wave">🌊 Ocean Wave</SelectItem>
                  <SelectItem value="cyber-chrome">⚡ Cyber Chrome</SelectItem>
                  <SelectItem value="fire-storm">🔥 Fire Storm</SelectItem>
                  <SelectItem value="cosmic-space">🚀 Cosmic Space</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                Changes the visual appearance of keypad buttons in quiz questions. The design applies to all keypad-based game modes.
              </p>
            </div>

            {/* Keypad Preview Section */}
            <div className="space-y-3">
              <Label className="text-foreground">Live Preview</Label>
              <div className="p-6 bg-muted rounded-lg border border-border">
                <div className="text-center mb-4">
                  <div className="text-lg font-medium mb-1">
                    {settings.keypadDesign === "neon-glow" && "🌟 Neon Glow"}
                    {settings.keypadDesign === "gaming-beast" && "🎮 Gaming Beast"}
                    {settings.keypadDesign === "matrix-green" && "🔋 Matrix Green"}
                    {settings.keypadDesign === "bubble-pop" && "🫧 Bubble Pop"}
                    {settings.keypadDesign === "ocean-wave" && "🌊 Ocean Wave"}
                    {settings.keypadDesign === "cyber-chrome" && "⚡ Cyber Chrome"}
                    {settings.keypadDesign === "fire-storm" && "🔥 Fire Storm"}
                    {settings.keypadDesign === "cosmic-space" && "🚀 Cosmic Space"}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {settings.keypadDesign === "neon-glow" && "Cyberpunk style with glowing cyan and pink colors"}
                    {settings.keypadDesign === "gaming-beast" && "Dark gaming aesthetic with red accents"}
                    {settings.keypadDesign === "matrix-green" && "Hacker/Matrix theme with green on black"}
                    {settings.keypadDesign === "bubble-pop" && "Playful pastel colors with gradients"}
                    {settings.keypadDesign === "ocean-wave" && "Blue/teal ocean theme with wave-like gradients"}
                    {settings.keypadDesign === "cyber-chrome" && "Metallic chrome finish with blue highlights"}
                    {settings.keypadDesign === "fire-storm" && "Fiery red/orange theme with dramatic styling"}
                    {settings.keypadDesign === "cosmic-space" && "Deep space purple theme with cosmic colors"}
                  </p>
                </div>
                
                {/* Actual Keypad Preview */}
                <div className="flex justify-center">
                  <KeypadPreview design={settings.keypadDesign || "neon-glow"} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderWaitingRoomSettings = () => (
    <div className="space-y-6">
      <Card className="bg-[#34495e] border-[#4a5568]">
        <CardHeader>
          <CardTitle className="text-[#ecf0f1] flex items-center gap-2">
            <Users className="w-5 h-5" />
            Waiting Room Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label className="text-[#ecf0f1]">Enable Waiting Room</Label>
            <Switch
              checked={settings.showWaitingRoom}
              onCheckedChange={(checked) => updateSetting("showWaitingRoom", checked)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-[#ecf0f1]">Allow Late Join</Label>
              <Switch
                checked={settings.allowLateJoin}
                onCheckedChange={(checked) => updateSetting("allowLateJoin", checked)}
              />
            </div>

          </div>

          <div>
            <Label htmlFor="max-participants" className="text-[#ecf0f1]">Max Participants (Set to 0 for no limit)</Label>
            <Input
              id="max-participants"
              type="number"
              value={settings.maxParticipants || 0}
              onChange={(e) => updateSetting("maxParticipants", parseInt(e.target.value))}
              className="bg-[#2c3e50] border-[#4a5568] text-[#ecf0f1] mt-2"
              min="0"
              max="5000"
            />
          </div>

          <div>
            <Label htmlFor="waiting-message" className="text-[#ecf0f1]">Waiting Room Message</Label>
            <Textarea
              id="waiting-message"
              value={settings.waitingRoomMessage}
              onChange={(e) => updateSetting("waitingRoomMessage", e.target.value)}
              className="bg-[#2c3e50] border-[#4a5568] text-[#ecf0f1] mt-2"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderExternalScreenSettings = () => (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            External Screen Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="display-resolution" className="text-foreground">Display Resolution</Label>
              <Select value={settings.displayResolution} onValueChange={(value) => updateSetting("displayResolution", value)}>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="854x480">854x480 (480p)</SelectItem>
                  <SelectItem value="1280x720">1280x720 (720p)</SelectItem>
                  <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                  <SelectItem value="2560x1440">2560x1440 (2K)</SelectItem>
                  <SelectItem value="3840x2160">3840x2160 (4K)</SelectItem>
                  <SelectItem value="auto">Auto Detect</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Fullscreen Mode</Label>
              <Switch
                checked={settings.fullscreenMode}
                onCheckedChange={(checked) => updateSetting("fullscreenMode", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Display Team Names</Label>
              <Switch
                checked={settings.displayTeamNames}
                onCheckedChange={(checked) => updateSetting("displayTeamNames", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Display Team Photos</Label>
              <Switch
                checked={settings.displayTeamPhotos}
                onCheckedChange={(checked) => updateSetting("displayTeamPhotos", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Display Team Scores</Label>
              <Switch
                checked={settings.displayTeamScores}
                onCheckedChange={(checked) => updateSetting("displayTeamScores", checked)}
              />
            </div>
          </div>

          <Separator className="bg-border" />
          
          <div className="space-y-3">
            <Label className="text-foreground">Countdown Style</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Choose the visual style for countdown timers on the external display
            </p>
            <Select
              value={settings.countdownStyle || "circular"}
              onValueChange={(value) => {
                updateSetting("countdownStyle", value);
                updateCountdownStyle(value as "circular" | "digital" | "pulsing" | "progress-bar" | "matrix" | "liquid" | "gradient");
              }}
            >
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="circular">Circular (Default)</SelectItem>
                <SelectItem value="digital">Digital Clock</SelectItem>
                <SelectItem value="pulsing">Pulsing</SelectItem>
                <SelectItem value="progress-bar">Progress Bar</SelectItem>
                <SelectItem value="matrix">Matrix</SelectItem>
                <SelectItem value="liquid">Liquid Fill</SelectItem>
                <SelectItem value="gradient">Gradient</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-border" />
          
          <div className="space-y-3">
            <h4 className="text-muted-foreground">Coming Soon</h4>
            <div className="flex items-center justify-between opacity-50">
              <Label className="text-foreground">Display QR Code To Socials</Label>
              <Switch
                checked={false}
                disabled={true}
              />
            </div>
            <div className="flex items-center justify-between opacity-50">
              <Label className="text-foreground">Display Online Sent Pictures</Label>
              <Switch
                checked={false}
                disabled={true}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderNetworkWiFiSettings = () => (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Wifi className="w-5 h-5" />
            Network & WiFi Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Player Device Status
              </Label>
              <Switch
                checked={settings.playerDeviceStatus}
                onCheckedChange={(checked) => updateSetting("playerDeviceStatus", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-foreground flex items-center gap-2">
                <Timer className="w-4 h-4" />
                Player Device Response Time
              </Label>
              <Switch
                checked={settings.playerDeviceResponseTime}
                onCheckedChange={(checked) => updateSetting("playerDeviceResponseTime", checked)}
              />
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-4">
            <div>
              <Label className="text-foreground mb-3 block">WiFi Network Style</Label>
              <div className="flex gap-2">
                <Button
                  variant={settings.wifiNetworkStyle === "stable" ? "default" : "outline"}
                  onClick={() => updateSetting("wifiNetworkStyle", "stable")}
                  className="flex-1"
                >
                  Stable
                </Button>
                <Button
                  variant={settings.wifiNetworkStyle === "experimental" ? "default" : "outline"}
                  onClick={() => updateSetting("wifiNetworkStyle", "experimental")}
                  className="flex-1"
                >
                  Experimental
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {settings.wifiNetworkStyle === "stable" 
                  ? "Stable mode provides reliable connections with standard features."
                  : "Experimental mode enables beta features and enhanced performance options."
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // External Screen Settings will be added here
  const renderExternalScreen = () => (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            External Display Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-foreground mb-3 block">
                Countdown Timer Style
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Choose the visual style for countdown timers displayed on the external screen
              </p>
              <Select 
                value={settings.countdownStyle || "circular"} 
                onValueChange={(value) => updateSetting("countdownStyle", value)}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Select countdown style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="circular">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-500 rounded-full"></div>
                      Circular Progress
                    </div>
                  </SelectItem>
                  <SelectItem value="digital">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-black border border-green-400 text-green-400 text-xs flex items-center justify-center font-mono">00</div>
                      Digital Clock
                    </div>
                  </SelectItem>
                  <SelectItem value="pulsing">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded animate-pulse"></div>
                      Pulsing Scale
                    </div>
                  </SelectItem>
                  <SelectItem value="progress-bar">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="w-2/3 h-full bg-blue-500"></div>
                      </div>
                      Progress Bar
                    </div>
                  </SelectItem>
                  <SelectItem value="matrix">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-black border border-green-400 text-green-400 text-xs flex items-center justify-center font-mono">M</div>
                      Matrix Style
                    </div>
                  </SelectItem>
                  <SelectItem value="liquid">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-200 rounded-full overflow-hidden relative">
                        <div className="absolute bottom-0 left-0 right-0 h-2 bg-blue-500"></div>
                      </div>
                      Liquid Fill
                    </div>
                  </SelectItem>
                  <SelectItem value="gradient">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 rounded"></div>
                      Gradient Wave
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-4">
            <div>
              <Label className="text-foreground mb-3 block">Display Resolution</Label>
              <Select 
                value={settings.displayResolution} 
                onValueChange={(value) => updateSetting("displayResolution", value)}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                  <SelectItem value="1280x720">1280x720 (HD)</SelectItem>
                  <SelectItem value="3840x2160">3840x2160 (4K)</SelectItem>
                  <SelectItem value="auto">Auto Detect</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground">Fullscreen Mode</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Display content in fullscreen on the external screen
              </p>
            </div>
            <Switch
              checked={settings.fullscreenMode}
              onCheckedChange={(checked) => updateSetting("fullscreenMode", checked)}
            />
          </div>


        </CardContent>
      </Card>
    </div>
  );

  const renderUpdatesSettings = () => (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Download className="w-5 h-5" />
            Updates & Version Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label className="text-foreground">Auto Update</Label>
            <Switch
              checked={settings.autoUpdate}
              onCheckedChange={(checked) => updateSetting("autoUpdate", checked)}
            />
          </div>

          <Separator className="bg-border" />

          <div className="space-y-4">
            <div>
              <Label className="text-foreground mb-3 block">Version Selection</Label>
              <Select 
                value={settings.selectedVersion && (settings.selectedVersion === "Stable" || settings.selectedVersion === "Beta Release") ? settings.selectedVersion : "Stable"} 
                onValueChange={(value) => updateSetting("selectedVersion", value)}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Stable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stable">Stable</SelectItem>
                  <SelectItem value="Beta Release">Beta Release</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                Select which version you want to run. Beta releases may contain experimental features.
              </p>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-foreground" />
                <Label className="text-foreground">Beta Access License Key</Label>
                {settings.licenseKeyValid && (
                  <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Valid
                  </Badge>
                )}
                {settings.licenseKey && !settings.licenseKeyValid && (
                  <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Invalid
                  </Badge>
                )}
              </div>
              <Input
                type="text"
                value={settings.licenseKey}
                onChange={(e) => handleLicenseKeyChange(e.target.value)}
                placeholder="Enter your beta access license key"
                className="bg-input border-border text-foreground"
              />
              <p className="text-sm text-muted-foreground mt-2">
                A valid license key is required to access early access versions and beta updates.
              </p>
            </div>
          </div>

          {settings.licenseKeyValid && (
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground mb-1">Beta Access Unlocked</h4>
                  <p className="text-sm text-muted-foreground">
                    You now have access to early access versions and beta features. 
                    These versions may contain experimental functionality and should be used with caution.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator className="bg-border" />

          <div className="space-y-4">
            <h4 className="text-foreground font-medium">Update Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Current Version:</Label>
                <p className="text-foreground">{settings.selectedVersion.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Update Channel:</Label>
                <p className="text-foreground">
                  {settings.selectedVersion.includes('early-access') ? 'Early Access' : 'Stable'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ WebkitAppRegion: 'no-drag' }}>
      <div className="bg-card w-full h-full max-w-6xl max-h-[90vh] rounded-lg border border-border flex overflow-hidden relative">
        {/* Sidebar */}
        <div className="w-64 bg-muted border-r border-border">
          <div className="px-6 py-4 border-b border-border min-h-[65px] flex items-center">
            <h2 className="text-xl font-semibold text-foreground">Settings</h2>
          </div>
          <div className="p-4 space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between min-h-[64px]" style={{ WebkitAppRegion: 'no-drag' }}>
            <h3 className="text-lg font-medium text-foreground capitalize">
              {activeTab.replace("-", " ")}
            </h3>
            <Button
              variant="ghost"
              size="lg"
              onClick={handleClose}
              className="close-btn-expanded text-muted-foreground hover:text-foreground pointer-events-auto relative z-10 !p-3"
            >
              <X className="w-6 h-6 pointer-events-none" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "general" && renderGeneralSettings()}
            {activeTab === "sounds" && renderSoundsSettings()}
            {activeTab === "style-themes" && renderStyleThemesSettings()}
            {activeTab === "waiting-room" && renderWaitingRoomSettings()}
            {activeTab === "external-screen" && renderExternalScreen()}
            {activeTab === "network-wifi" && renderNetworkWiFiSettings()}
            {activeTab === "updates" && renderUpdatesSettings()}
            {activeTab === "advanced-features" && (
              <div className="space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-card-foreground flex items-center gap-2">
                      <Wrench className="w-5 h-5" />
                      Advanced Features
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-foreground flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Response Times
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Show response time boxes next to team answers in the sidebar
                          </p>
                        </div>
                        <Switch
                          checked={settings.responseTimesEnabled}
                          onCheckedChange={(checked) => updateSetting("responseTimesEnabled", checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-foreground flex items-center gap-2">
                            <Camera className="w-4 h-4" />
                            Team Photos
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Automatically approve team photos when they are uploaded
                          </p>
                        </div>
                        <Switch
                          checked={settings.teamPhotosAutoApprove || false}
                          onCheckedChange={(checked) => updateSetting("teamPhotosAutoApprove", checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-foreground flex items-center gap-2">
                            <Skull className="w-4 h-4" />
                            Evil Mode
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Teams lose points for wrong answers in keypad mode
                          </p>
                        </div>
                        <Switch
                          checked={settings.evilModeEnabled || false}
                          onCheckedChange={(checked) => updateSetting("evilModeEnabled", checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-foreground flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Punishment Mode
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            With Evil Mode: teams also lose points for no answer
                          </p>
                        </div>
                        <Switch
                          checked={settings.punishmentEnabled || false}
                          onCheckedChange={(checked) => updateSetting("punishmentEnabled", checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-foreground flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            Feature Toggle 3
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Advanced feature toggle - to be labeled later
                          </p>
                        </div>
                        <Switch
                          checked={settings.featureToggle3 || false}
                          onCheckedChange={(checked) => updateSetting("featureToggle3", checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-foreground flex items-center gap-2">
                            <Lock className="w-4 h-4" />
                            Feature Toggle 4
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Advanced feature toggle - to be labeled later
                          </p>
                        </div>
                        <Switch
                          checked={settings.featureToggle4 || false}
                          onCheckedChange={(checked) => updateSetting("featureToggle4", checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            {activeTab === "bug-report" && (
              <div className="space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-card-foreground flex items-center gap-2">
                      <Bug className="w-5 h-5" />
                      Bug Report
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <p className="text-sm text-muted-foreground">
                        <strong>Help us improve the software!</strong> If you've encountered any bugs, issues, or unexpected behavior, 
                        please describe them in detail below. Your feedback helps us make the quiz hosting experience better for everyone.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="bug-category" className="text-foreground">Issue Category</Label>
                        <Select defaultValue="general">
                          <SelectTrigger className="bg-input border-border text-foreground mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General Issue</SelectItem>
                            <SelectItem value="display">Display Problems</SelectItem>
                            <SelectItem value="audio">Audio Issues</SelectItem>
                            <SelectItem value="performance">Performance</SelectItem>
                            <SelectItem value="ui">User Interface</SelectItem>
                            <SelectItem value="settings">Settings</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="bug-description" className="text-foreground">Bug Description</Label>
                        <Textarea
                          id="bug-description"
                          placeholder="Please describe the bug or issue you encountered. Include:&#10;• What you were trying to do&#10;• What happened instead&#10;• Steps to reproduce the issue&#10;• Any error messages you saw"
                          className="bg-input border-border text-foreground mt-2 min-h-[120px]"
                          rows={6}
                        />
                      </div>

                      <div>
                        <Label htmlFor="bug-steps" className="text-foreground">Steps to Reproduce (Optional)</Label>
                        <Textarea
                          id="bug-steps"
                          placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                          className="bg-input border-border text-foreground mt-2"
                          rows={4}
                        />
                      </div>


                    </div>

                    <Separator className="bg-border" />

                    <div className="flex gap-3">
                      <Button 
                        className="flex-1"
                        onClick={() => {
                          // TODO: Implement actual submission to website
                          alert('Bug report submitted! Thank you for your feedback. We will review your report and work on fixing the issue.');
                          // Clear form after submission
                          const form = document.querySelector('#bug-description') as HTMLTextAreaElement;
                          if (form) form.value = '';
                          const steps = document.querySelector('#bug-steps') as HTMLTextAreaElement;
                          if (steps) steps.value = '';
                          const contact = document.querySelector('#bug-contact') as HTMLInputElement;
                          if (contact) contact.value = '';
                        }}
                      >
                        Submit Bug Report
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          // Clear all form fields
                          const form = document.querySelector('#bug-description') as HTMLTextAreaElement;
                          if (form) form.value = '';
                          const steps = document.querySelector('#bug-steps') as HTMLTextAreaElement;
                          if (steps) steps.value = '';
                          const contact = document.querySelector('#bug-contact') as HTMLInputElement;
                          if (contact) contact.value = '';
                        }}
                      >
                        Clear Form
                      </Button>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg border border-border">
                      <h4 className="font-medium text-foreground mb-2">Privacy Notice:</h4>
                      <p className="text-sm text-muted-foreground">
                        Your bug reports help us improve the software. We do not collect personal information beyond what you voluntarily provide. 
                        Contact information is used only for follow-up questions about your report.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {hasUnsavedChanges && (
                <>
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  Unsaved changes
                </>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>

        {/* Confirmation Modal for Unsaved Changes */}
        {showConfirmClose && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-[60] rounded-lg">
            <div className="bg-card border border-border rounded-lg shadow-lg p-6 max-w-sm mx-4">
              <h3 className="text-lg font-semibold text-foreground mb-2">Unsaved Changes</h3>
              <p className="text-sm text-muted-foreground mb-6">
                You have unsaved changes. Do you want to discard them?
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={handleCancelClose}
                  className="text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmClose}
                >
                  Discard Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
