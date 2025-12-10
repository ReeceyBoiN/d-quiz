import React, { useState } from "react";
import { Settings, Smartphone, X, Users, Image, Zap } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { PersistentImageManager } from "./PersistentImageManager";
import { StoredImage } from "../utils/projectImageStorage";

interface PlayerDevicesSettingsProps {
  onClose: () => void;
  onImagesChange: (images: StoredImage[]) => void;
  images: StoredImage[];
  playerDevicesDisplayMode: "basic" | "slideshow" | "scores";
  onSlideshowSecondsChange?: (seconds: number) => void;
  currentSlideshowSeconds?: number;
}

export function PlayerDevicesSettings({
  onClose,
  onImagesChange,
  images,
  playerDevicesDisplayMode,
  onSlideshowSecondsChange,
  currentSlideshowSeconds = 10
}: PlayerDevicesSettingsProps) {
  const [slideshowSeconds, setSlideshowSeconds] = useState<number>(currentSlideshowSeconds);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Settings Panel */}
      <Card className="relative w-full max-w-6xl mx-4 bg-[#34495e] border-[#4a5568] shadow-2xl max-h-[90vh] overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-[#3498db]" />
              <CardTitle className="text-[#ecf0f1]">Player Devices Settings</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="w-8 h-8 p-0 text-[#95a5a6] hover:text-[#ecf0f1] hover:bg-[#4a617a]"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="text-[#95a5a6]">
            Configure images and content to display on player devices
          </CardDescription>
        </CardHeader>

        <CardContent className="max-h-[75vh] overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Device Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Device Status */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#f39c12]" />
                  <h3 className="text-[#ecf0f1] font-medium text-lg">Device Status</h3>
                </div>
                
                <div className="space-y-4 bg-[#2c3e50] rounded-lg p-4 border border-[#4a5568]">
                  <div className="text-sm text-[#95a5a6] space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Display Mode:</span>
                      <span className="text-[#3498db] font-medium uppercase">
                        {playerDevicesDisplayMode}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Connected Devices:</span>
                      <span className="text-[#27ae60] font-medium">0</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="bg-[#2c3e50] rounded-lg p-4 border border-[#4a5568]">
                <div className="flex items-center gap-2 mb-3">
                  <Image className="w-4 h-4 text-[#f39c12]" />
                  <h4 className="text-[#ecf0f1] font-medium">Content Status</h4>
                </div>
                <div className="text-xs text-[#95a5a6] space-y-2">
                  <div className="flex justify-between">
                    <span>Images Available:</span>
                    <span className="text-[#f39c12]">{images.length}</span>
                  </div>
                </div>
              </div>

              {/* Speed Control for Slideshow Only */}
              {playerDevicesDisplayMode === 'slideshow' && (
                <div className="bg-[#34495e] rounded-lg p-4 border border-[#4a5568]">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-[#f39c12]" />
                    <h4 className="text-[#ecf0f1] font-medium">Slideshow Speed</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="2"
                        max="60"
                        value={slideshowSeconds}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value);
                          setSlideshowSeconds(newValue);
                          onSlideshowSecondsChange?.(newValue);
                        }}
                        className="flex-1 h-2 bg-[#2c3e50] rounded-lg appearance-none cursor-pointer accent-[#f39c12]"
                      />
                      <input
                        type="number"
                        min="2"
                        max="60"
                        value={slideshowSeconds}
                        onChange={(e) => {
                          const newValue = Math.max(2, Math.min(60, parseInt(e.target.value) || currentSlideshowSeconds));
                          setSlideshowSeconds(newValue);
                          onSlideshowSecondsChange?.(newValue);
                        }}
                        className="w-16 px-2 py-1 bg-[#2c3e50] text-[#ecf0f1] border border-[#4a5568] rounded text-sm"
                      />
                      <span className="text-[#95a5a6] text-sm min-w-fit">seconds</span>
                    </div>
                    <div className="text-xs text-[#95a5a6] mt-2">
                      Each image will display for {slideshowSeconds} seconds before rotating to the next one
                    </div>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-[#34495e] rounded-lg p-4 border border-[#4a5568]">
                <h4 className="text-[#ecf0f1] font-medium mb-2">Display Modes</h4>
                <div className="text-xs text-[#95a5a6] space-y-3">
                  <div>
                    <p className="font-medium text-[#f39c12]">Basic</p>
                    <p>Shows "Pop Quiz" with animated background. Perfect for between rounds.</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#00ff4c]">Slideshow</p>
                    <p>Cycles through images from the Phone Slideshow folder.</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#3498db]">Scores</p>
                    <p>Displays the live leaderboard with scrolling animation. Updates automatically as scores change.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Columns - Image Management */}
            <div className="lg:col-span-2">
              <PersistentImageManager onImagesChange={onImagesChange} />
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
