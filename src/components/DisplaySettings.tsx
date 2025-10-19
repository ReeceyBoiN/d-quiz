import React from "react";
import { Settings, Clock, X } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { PersistentImageManager } from "./PersistentImageManager";
import { StoredImage } from "../utils/projectImageStorage";

interface DisplaySettingsProps {
  onClose: () => void;
  slideshowSpeed: number;
  onSpeedChange: (speed: number) => void;
  onImagesChange: (images: StoredImage[]) => void;
  images: StoredImage[];
}

export function DisplaySettings({
  onClose,
  slideshowSpeed,
  onSpeedChange,
  onImagesChange,
  images
}: DisplaySettingsProps) {

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
              <Settings className="w-5 h-5 text-[#3498db]" />
              <CardTitle className="text-[#ecf0f1]">Display Settings</CardTitle>
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
            Configure display preferences for the external screen
          </CardDescription>
        </CardHeader>

        <CardContent className="max-h-[75vh] overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Slideshow Settings */}
            <div className="lg:col-span-1 space-y-6">
              {/* Slideshow Speed */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#f39c12]" />
                  <h3 className="text-[#ecf0f1] font-medium text-lg">Slideshow Settings</h3>
                </div>
                
                <div className="space-y-4 bg-[#2c3e50] rounded-lg p-4 border border-[#4a5568]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#95a5a6]">Change every</span>
                    <span className="text-sm font-medium text-[#3498db] bg-[#34495e] px-3 py-1 rounded">
                      {slideshowSpeed} second{slideshowSpeed !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <Slider
                    value={[slideshowSpeed]}
                    onValueChange={(value) => onSpeedChange(value[0])}
                    max={30}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  
                  <div className="flex justify-between text-xs text-[#7f8c8d]">
                    <span>1s (Fast)</span>
                    <span>30s (Slow)</span>
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="bg-[#2c3e50] rounded-lg p-4 border border-[#4a5568]">
                <h4 className="text-[#ecf0f1] font-medium mb-3">Display Status</h4>
                <div className="text-xs text-[#95a5a6] space-y-2">
                  <div className="flex justify-between">
                    <span>Display Mode:</span>
                    <span className="text-[#3498db]">Slideshow</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Images Loaded:</span>
                    <span className="text-[#f39c12]">{images.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Loop Images:</span>
                    <span className="text-[#27ae60]">Enabled</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto Advance:</span>
                    <span className="text-[#27ae60]">Yes</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transition:</span>
                    <span className="text-[#f39c12]">Fade</span>
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