import React, { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Pencil, Upload, UserX, RotateCcw, Smartphone, X } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface Quiz {
  id: string;
  name: string;
  type: "test" | "round";
  icon?: string;
  score?: number;
  color?: string;
  photo?: string;
  buzzer?: string;
  scrambled?: boolean;
}

interface TeamSettingsProps {
  team: Quiz;
  onClose: () => void;
  onTeamUpdate: (teamId: string, updates: Partial<Quiz>) => void;
  onKickTeam: (teamId: string) => void;
  onScrambleKeypad?: (teamId: string) => void;
}

const TEAM_COLORS = [
  { value: "#e74c3c", label: "Red" },
  { value: "#3498db", label: "Blue" },
  { value: "#2ecc71", label: "Green" },
  { value: "#f39c12", label: "Orange" },
  { value: "#9b59b6", label: "Purple" },
  { value: "#1abc9c", label: "Teal" },
  { value: "#e67e22", label: "Orange Dark" },
  { value: "#34495e", label: "Dark Blue" },
  { value: "#f1c40f", label: "Yellow" },
  { value: "#95a5a6", label: "Gray" },
];

const BUZZER_TYPES = [
  { value: "default", label: "Default Buzzer" },
  { value: "bell", label: "Bell Sound" },
  { value: "horn", label: "Air Horn" },
  { value: "beep", label: "Electronic Beep" },
  { value: "chime", label: "Wind Chime" },
  { value: "click", label: "Click Sound" },
];

export function TeamSettings({ team, onClose, onTeamUpdate, onKickTeam, onScrambleKeypad }: TeamSettingsProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(team.name);
  const [selectedColor, setSelectedColor] = useState(team.color || "#3498db");
  const [selectedBuzzer, setSelectedBuzzer] = useState(team.buzzer || "default");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate plotting squares (8x8 grid for team positions/seats)
  const generatePlottingSquares = () => {
    const squares = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isActive = Math.random() > 0.7; // Random active squares for demo
        squares.push(
          <div
            key={`${row}-${col}`}
            className={`w-6 h-6 border border-gray-400 rounded cursor-pointer transition-colors ${
              isActive 
                ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
            onClick={() => {
              // Handle square click for seat assignment
              console.log(`Square clicked: ${row}, ${col}`);
            }}
            title={`Position ${row + 1}, ${col + 1}`}
          />
        );
      }
    }
    return squares;
  };

  const handleNameSave = () => {
    if (editName.trim()) {
      onTeamUpdate(team.id, { name: editName.trim() });
      setIsEditingName(false);
    }
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    onTeamUpdate(team.id, { color });
  };

  const handleBuzzerChange = (buzzer: string) => {
    setSelectedBuzzer(buzzer);
    onTeamUpdate(team.id, { buzzer });
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const photoUrl = e.target?.result as string;
        onTeamUpdate(team.id, { photo: photoUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScrambleKeypad = () => {
    if (onScrambleKeypad) {
      onScrambleKeypad(team.id);
    } else {
      // Fallback to using onTeamUpdate if onScrambleKeypad is not provided
      const newScrambledState = !team.scrambled;
      onTeamUpdate(team.id, { scrambled: newScrambledState });
      console.log(`${newScrambledState ? 'Scrambling' : 'Unscrambling'} keypad for team ${team.name}`);
    }
  };

  const handleHotSwap = () => {
    // Simulate hot swap to new device
    console.log(`Hot swapping team ${team.name} to new device`);
    // You can implement actual hot swap logic here
  };

  const handleKick = () => {
    if (confirm(`Are you sure you want to kick team "${team.name}"?`)) {
      onKickTeam(team.id);
      onClose();
    }
  };

  return (
    <div className="h-full bg-background p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header with team name and close button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground">Team Settings</h1>
            <Badge 
              variant="outline" 
              className="text-lg px-3 py-1"
              style={{ backgroundColor: selectedColor, color: 'white' }}
            >
              {team.icon} #{team.id}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Team name with edit functionality */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNameSave();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                    onBlur={handleNameSave}
                    className="text-2xl font-bold text-center"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{team.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingName(true)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Plotting Map */}
            <Card>
              <CardHeader>
                <CardTitle>Team Position Map</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-8 gap-1 p-4 bg-muted rounded-lg">
                  {generatePlottingSquares()}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Click squares to assign team member positions
                </p>
              </CardContent>
            </Card>

            {/* Team Photo */}
            <Card>
              <CardHeader>
                <CardTitle>Team Photo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  {team.photo ? (
                    <ImageWithFallback
                      src={team.photo}
                      alt={`${team.name} photo`}
                      className="w-32 h-32 object-cover rounded-lg border-2 border-border"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-muted rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <span className="text-sm">No photo</span>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Team Photo
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Team Color */}
            <Card>
              <CardHeader>
                <CardTitle>Team Color</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedColor} onValueChange={handleColorChange}>
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: selectedColor }}
                        />
                        {TEAM_COLORS.find(c => c.value === selectedColor)?.label}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-border"
                            style={{ backgroundColor: color.value }}
                          />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Buzzer Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Team Buzzer</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedBuzzer} onValueChange={handleBuzzerChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUZZER_TYPES.map((buzzer) => (
                      <SelectItem key={buzzer.value} value={buzzer.value}>
                        {buzzer.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Team Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleScrambleKeypad}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {team.scrambled ? 'Unscramble' : 'Scramble'} Keypad for This Team
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleHotSwap}
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  Hot Swap To New Device
                </Button>
                
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={handleKick}
                >
                  <UserX className="w-4 h-4 mr-2" />
                  Kick Team
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}