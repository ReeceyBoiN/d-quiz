import { X, MapPin, Upload, Pencil, UserX, RotateCcw, Smartphone, Trash2, Zap, WifiOff, Wifi, Shield, ShieldOff } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "./ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface TeamWindowProps {
  team: {
    id: string;
    name: string;
    score?: number;
    icon?: string;
    location?: { x: number; y: number }; // Grid coordinates (0-9)
    buzzerSound?: string;
    backgroundColor?: string;
    photoUrl?: string;
    disconnected?: boolean; // Whether the team is disconnected from their device
    blocked?: boolean; // Whether the team is blocked from earning points
    scrambled?: boolean; // Whether the team's keypad is scrambled
  };
  hostLocation?: { x: number; y: number } | null;
  onClose: () => void;
  onLocationChange?: (teamId: string, location: { x: number; y: number }) => void;
  onNameChange?: (teamId: string, newName: string) => void;
  onBuzzerChange?: (teamId: string, buzzerSound: string) => void;
  onBackgroundColorChange?: (teamId: string, color: string) => void;
  onPhotoUpload?: (teamId: string, photoUrl: string) => void;
  onKickTeam?: (teamId: string) => void;
  onDisconnectTeam?: (teamId: string) => void;
  onReconnectTeam?: (teamId: string) => void;
  onBlockTeam?: (teamId: string, blocked: boolean) => void;
  onScrambleKeypad?: (teamId: string) => void;
  onHotSwap?: (teamId: string) => void;
  onHostLocationChange?: (location: { x: number; y: number } | null) => void;
  onClearAllLocations?: () => void;
}

export function TeamWindow({ 
  team, 
  hostLocation,
  onClose, 
  onLocationChange,
  onNameChange,
  onBuzzerChange,
  onBackgroundColorChange,
  onPhotoUpload,
  onKickTeam,
  onDisconnectTeam,
  onReconnectTeam,
  onBlockTeam,
  onScrambleKeypad,
  onHotSwap,
  onHostLocationChange,
  onClearAllLocations
}: TeamWindowProps) {
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(team.name);
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [isDraggingHost, setIsDraggingHost] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isEvilModeEnabled, setIsEvilModeEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug logging for team prop changes
  useEffect(() => {
    console.log(`🔀 TeamWindow: Team data updated for ${team.name} (${team.id}), scrambled:`, team.scrambled);
  }, [team.scrambled, team.name, team.id]);

  const handleCellClick = (x: number, y: number) => {
    if (onLocationChange) {
      onLocationChange(team.id, { x, y });
    }
  };

  const handleHostDrop = (x: number, y: number) => {
    if (onHostLocationChange) {
      onHostLocationChange({ x, y });
    }
    setIsDraggingHost(false);
  };

  const handleClearHostLocation = () => {
    if (onHostLocationChange) {
      onHostLocationChange(null);
    }
  };

  const handleClearAllLocations = () => {
    if (onClearAllLocations) {
      onClearAllLocations();
    }
    if (onHostLocationChange) {
      onHostLocationChange(null);
    }
  };

  const isCellSelected = (x: number, y: number) => {
    return team.location?.x === x && team.location?.y === y;
  };

  const isCellHovered = (x: number, y: number) => {
    return hoveredCell?.x === x && hoveredCell?.y === y;
  };

  const isHostLocation = (x: number, y: number) => {
    return hostLocation?.x === x && hostLocation?.y === y;
  };

  const handleNameSave = () => {
    if (editedName.trim() && onNameChange) {
      onNameChange(team.id, editedName.trim());
    }
    setIsEditingName(false);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onPhotoUpload) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onPhotoUpload(team.id, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKickTeam = () => {
    setShowKickConfirm(true);
  };

  const confirmKickTeam = () => {
    if (onKickTeam) {
      onKickTeam(team.id);
    }
    setShowKickConfirm(false);
    onClose();
  };

  const handleDisconnectTeam = () => {
    setShowDisconnectConfirm(true);
  };

  const confirmDisconnectTeam = () => {
    if (onDisconnectTeam) {
      onDisconnectTeam(team.id);
    }
    setShowDisconnectConfirm(false);
    onClose();
  };

  const handleReconnectTeam = () => {
    if (onReconnectTeam) {
      onReconnectTeam(team.id);
    }
  };

  const handleBlockTeam = (blocked: boolean) => {
    if (onBlockTeam) {
      onBlockTeam(team.id, blocked);
    }
  };

  // Handle mouse events for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingHost) {
        setMousePosition({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingHost(false);
    };

    if (isDraggingHost) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingHost]);

  const buzzerSounds = [
    { value: "classic", label: "🔔 Classic Buzzer" },
    { value: "ding", label: "🎵 Ding" },
    { value: "horn", label: "📢 Air Horn" },
    { value: "bell", label: "🔔 Bell" },
    { value: "chime", label: "🎶 Chime" },
    { value: "beep", label: "🔊 Beep" },
    { value: "whistle", label: "🎺 Whistle" },
    { value: "gong", label: "🥁 Gong" }
  ];

  const backgroundColors = [
    { value: "clear", label: "⬜ Clear (Default)" },
    { value: "#e74c3c", label: "🔴 Red" },
    { value: "#3498db", label: "🔵 Blue" },
    { value: "#2ecc71", label: "🟢 Green" },
    { value: "#f39c12", label: "🟠 Orange" },
    { value: "#9b59b6", label: "🟣 Purple" },
    { value: "#1abc9c", label: "🔷 Teal" },
    { value: "#e67e22", label: "🟧 Dark Orange" },
    { value: "#34495e", label: "⬛ Dark Gray" },
    { value: "#f1c40f", label: "🟡 Yellow" },
    { value: "#95a5a6", label: "⚪ Silver" }
  ];

  return (
    <div className="h-full w-full bg-background flex flex-col">
      {/* Header with Team Name in Center */}
      <div className="bg-sidebar-accent border-b border-sidebar-border px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left side - Team Icon */}
          <div className="flex items-center gap-3 flex-1">
            {team.icon && (
              <span className="text-3xl emoji emoji-font">{team.icon}</span>
            )}
          </div>
          
          {/* Center - Team Name (editable) */}
          <div className="flex items-center gap-2 justify-center flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameSave();
                    if (e.key === 'Escape') {
                      setEditedName(team.name);
                      setIsEditingName(false);
                    }
                  }}
                  className="w-64"
                  autoFocus
                />
                <Button onClick={handleNameSave} size="sm" variant="default">
                  Save
                </Button>
                <Button 
                  onClick={() => {
                    setEditedName(team.name);
                    setIsEditingName(false);
                  }} 
                  size="sm" 
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-foreground">
                  {team.name}
                </h2>
                <Button
                  onClick={() => setIsEditingName(true)}
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Right side - Close Button */}
          <div className="flex items-center gap-2 justify-end flex-1">
            {team.score !== undefined && (
              <span className="text-sm text-muted-foreground mr-2">
                Score: {team.score}
              </span>
            )}
            <Button 
              onClick={onClose}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Close
            </Button>
          </div>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Physical Location Mapping Section */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Physical Location</h3>
                </div>
                <div className="flex gap-2">
                  {hostLocation && (
                    <Button
                      onClick={handleClearHostLocation}
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear Host
                    </Button>
                  )}
                  <Button
                    onClick={handleClearAllLocations}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear Grid
                  </Button>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                Click on the grid to mark where this team is physically located in the room.
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                🔴 Red pin = Host location (drag to move) | 🔵 Blue dot = Team location
              </p>
              
              {/* Host Pin (draggable) - Show if no host location OR if currently dragging */}
              {(!hostLocation || isDraggingHost) && (
                <div className="mb-4 flex justify-center">
                  <div
                    className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg border-2 border-white relative z-20"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsDraggingHost(true);
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDragOffset({
                        x: e.clientX - rect.left - rect.width / 2,
                        y: e.clientY - rect.top - rect.height / 2
                      });
                      setMousePosition({ x: e.clientX, y: e.clientY });
                    }}
                    style={isDraggingHost ? {
                      position: 'fixed',
                      left: mousePosition.x - dragOffset.x - 16,
                      top: mousePosition.y - dragOffset.y - 16,
                      pointerEvents: 'none',
                      zIndex: 1000
                    } : {}}
                    title="Drag this red pin to place the host location"
                  >
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
              
              {/* 10x10 Grid - Compact */}
              <div className="flex justify-center">
                <div className="inline-block bg-background border-2 border-border rounded-lg p-2 relative">
                  <div className="grid grid-cols-10 gap-0.5">
                    {Array.from({ length: 10 }, (_, row) =>
                      Array.from({ length: 10 }, (_, col) => {
                        const isSelected = isCellSelected(col, row);
                        const isHovered = isCellHovered(col, row);
                        const isHost = isHostLocation(col, row);
                        
                        return (
                          <button
                            key={`${row}-${col}`}
                            onClick={() => {
                              if (isDraggingHost) {
                                handleHostDrop(col, row);
                              } else {
                                handleCellClick(col, row);
                              }
                            }}
                            onMouseEnter={() => {
                              setHoveredCell({ x: col, y: row });
                            }}
                            onMouseLeave={() => setHoveredCell(null)}
                            onMouseUp={() => {
                              if (isDraggingHost) {
                                handleHostDrop(col, row);
                              }
                            }}
                            className={`
                              w-6 h-6 border rounded transition-all duration-200 relative
                              ${isDraggingHost && isHovered
                                ? 'bg-red-300 border-red-400 scale-110'
                                : isHost
                                ? 'bg-red-500 border-red-600 shadow-lg'
                                : isSelected 
                                ? 'bg-primary border-primary shadow-lg scale-110' 
                                : isHovered
                                ? 'bg-primary/30 border-primary/50 scale-105'
                                : 'bg-muted border-border hover:bg-muted-foreground/10'
                              }
                            `}
                            title={`Position (${col}, ${row})${isHost ? ' - Host Location' : ''}`}
                          >
                            {isHost && (
                              <div 
                                className="flex items-center justify-center cursor-grab active:cursor-grabbing"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setIsDraggingHost(true);
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setDragOffset({
                                    x: e.clientX - rect.left - rect.width / 2,
                                    y: e.clientY - rect.top - rect.height / 2
                                  });
                                  setMousePosition({ x: e.clientX, y: e.clientY });
                                  // Clear the current host location so it can be moved
                                  if (onHostLocationChange) {
                                    onHostLocationChange(null);
                                  }
                                }}
                                title="Drag to move host location"
                              >
                                <MapPin className="w-4 h-4 text-white" />
                              </div>
                            )}
                            {isSelected && !isHost && (
                              <div className="flex items-center justify-center">
                                <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
                                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })
                    ).flat()}
                  </div>
                  
                  {/* Grid Labels */}
                  <div className="mt-2 flex justify-between items-center text-xs text-muted-foreground">
                    <span>← Left</span>
                    <span>Right →</span>
                  </div>
                  <div className="mt-1 text-center text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>↑ Front</span>
                      <span>Back ↓</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Location Info */}
              <div className="mt-4 space-y-2">
                {team.location && (
                  <div className="text-center">

                  </div>
                )}
                {hostLocation && (
                  <div className="text-center">

                  </div>
                )}
              </div>
            </div>

            {/* Team Photo Section */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Team Photo</h3>
              </div>
              
              <div className="space-y-4">
                {/* Photo Preview */}
                <div className="flex justify-center">
                  <div className="w-48 h-48 border-2 border-dashed border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    {team.photoUrl ? (
                      <ImageWithFallback
                        src={team.photoUrl}
                        alt={`${team.name} photo`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground p-4">
                        <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No photo uploaded</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Upload Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {team.photoUrl ? 'Change Photo' : 'Upload Photo'}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Audio & Visual Settings */}
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="space-y-4">
                {/* Buzzer Sound Selection */}
                <div className="space-y-2">
                  <Label htmlFor="buzzer-sound">Team Buzzer Sound</Label>
                  <Select
                    value={team.buzzerSound || "classic"}
                    onValueChange={(value) => onBuzzerChange?.(team.id, value)}
                  >
                    <SelectTrigger id="buzzer-sound" className="emoji emoji-font">
                      <SelectValue placeholder="Select buzzer sound" />
                    </SelectTrigger>
                    <SelectContent className="emoji emoji-font">
                      {buzzerSounds.map((sound) => (
                        <SelectItem key={sound.value} value={sound.value} className="emoji emoji-font">
                          {sound.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This sound will play when the team buzzes in
                  </p>
                </div>

                {/* Background Color Selection */}
                <div className="space-y-2">
                  <Label htmlFor="background-color">Team Background Color</Label>
                  <Select
                    value={team.backgroundColor || "clear"}
                    onValueChange={(value) => onBackgroundColorChange?.(team.id, value === "clear" ? "" : value)}
                  >
                    <SelectTrigger id="background-color" className="emoji emoji-font">
                      <SelectValue placeholder="Select background color" />
                    </SelectTrigger>
                    <SelectContent className="emoji emoji-font">
                      {backgroundColors.map((color) => (
                        <SelectItem key={color.value} value={color.value} className="emoji emoji-font">
                          {color.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Team Actions */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <h3 className="font-semibold text-foreground mb-4">Team Actions</h3>
              
              <div className="space-y-3">
                {/* Scramble Keypad Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4" />
                      <Label htmlFor="scramble-toggle" className="text-sm">
                        Scramble Keypad for This Team
                      </Label>
                    </div>
                    <Switch
                      id="scramble-toggle"
                      checked={team.scrambled || false}
                      onCheckedChange={() => onScrambleKeypad?.(team.id)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground ml-1">
                    {team.scrambled 
                      ? "Team's keypad is currently scrambled - toggle to unscramble" 
                      : "Toggle to randomize the keypad layout for this team only"
                    }
                  </p>
                </div>

                {/* Evil Mode Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={() => {
                        // Placeholder for future functionality
                        console.log("Evil mode activated for team:", team.id);
                      }}
                      variant="outline"
                      className="flex-1 gap-2 justify-start mr-3"
                      disabled={!isEvilModeEnabled}
                    >
                      <Zap className="w-4 h-4" />
                      Evil Mode for This Team
                    </Button>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="evil-mode-toggle" className="text-sm">
                        Enable
                      </Label>
                      <Switch
                        id="evil-mode-toggle"
                        checked={isEvilModeEnabled}
                        onCheckedChange={setIsEvilModeEnabled}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground ml-1">
                    {isEvilModeEnabled 
                      ? "Activate special challenge mode for this team" 
                      : "Enable evil mode for enhanced difficulty"
                    }
                  </p>
                </div>

                {/* Block Team Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {team.blocked ? (
                        <ShieldOff className="w-4 h-4 text-red-500" />
                      ) : (
                        <Shield className="w-4 h-4 text-green-500" />
                      )}
                      <Label htmlFor="block-toggle" className="text-sm font-medium">
                        Block Team from Earning Points
                      </Label>
                    </div>
                    <Switch
                      id="block-toggle"
                      checked={team.blocked || false}
                      onCheckedChange={(checked) => handleBlockTeam(checked)}
                      className="data-[state=checked]:bg-red-500"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground ml-1">
                    {team.blocked 
                      ? "Team is blocked and cannot earn points from correct answers" 
                      : "Team can earn points normally from correct answers"
                    }
                  </p>
                </div>

                {/* Hot Swap Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => onHotSwap?.(team.id)}
                      variant="outline"
                      className="flex-1 gap-2 justify-start"
                    >
                      <Smartphone className="w-4 h-4" />
                      Hot Swap To New Device
                    </Button>
                    <Button
                      onClick={() => {
                        // Placeholder for future functionality
                        console.log("Hot swap button clicked for team:", team.id);
                      }}
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                    >
                      <Smartphone className="w-3 h-3" />
                      Swap
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground ml-1">
                    Transfer this team to a new device
                  </p>
                </div>

                {/* Disconnect/Reconnect Team Button */}
                {team.disconnected ? (
                  <>
                    <Button
                      onClick={handleReconnectTeam}
                      variant="outline"
                      className="w-full gap-2 justify-start border-green-400 text-green-400 hover:bg-green-400 hover:text-white"
                    >
                      <Wifi className="w-4 h-4" />
                      Reconnect Team
                    </Button>
                    <p className="text-xs text-muted-foreground -mt-1 ml-1">
                      Reconnect this team to their device
                    </p>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleDisconnectTeam}
                      variant="outline"
                      className="w-full gap-2 justify-start border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-white"
                    >
                      <WifiOff className="w-4 h-4" />
                      Disconnect Team
                    </Button>
                    <p className="text-xs text-muted-foreground -mt-1 ml-1">
                      Disconnect this team from their device
                    </p>
                  </>
                )}

                {/* Kick Team Button */}
                <Button
                  onClick={handleKickTeam}
                  variant="destructive"
                  className="w-full gap-2 justify-start"
                >
                  <UserX className="w-4 h-4" />
                  Kick Team
                </Button>
                <p className="text-xs text-muted-foreground -mt-1 ml-1">
                  Remove this team from the game
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Kick Team Confirmation Dialog */}
      <AlertDialog open={showKickConfirm} onOpenChange={setShowKickConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kick Team "{team.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to kick this team from the game? This action cannot be undone.
              {team.score !== undefined && team.score > 0 && (
                <span className="block mt-2 text-destructive">
                  ⚠️ This team has {team.score} points that will be lost.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmKickTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Kick Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Team Confirmation Dialog */}
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Team "{team.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this team from their device? The team will remain in the game but will lose connection to their keypad interface.
              {team.score !== undefined && team.score > 0 && (
                <span className="block mt-2 text-muted-foreground">
                  📱 This team will keep their {team.score} points but won't be able to answer questions until they reconnect.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnectTeam} className="bg-orange-500 text-white hover:bg-orange-600">
              Disconnect Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
