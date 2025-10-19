import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Trash2, Upload, Image as ImageIcon, FolderOpen } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface ImageFile {
  id: string;
  name: string;
  url: string;
  file: File;
}

interface ImageManagerProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageFile[];
  onImagesChange: (images: ImageFile[]) => void;
}

export function ImageManager({ isOpen, onClose, images, onImagesChange }: ImageManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newImages: ImageFile[] = [];
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const id = Math.random().toString(36).substr(2, 9);
        const url = URL.createObjectURL(file);
        newImages.push({ id, name: file.name, url, file });
      }
    });

    onImagesChange([...images, ...newImages]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeImage = (id: string) => {
    const imageToRemove = images.find(img => img.id === id);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    onImagesChange(images.filter(img => img.id !== id));
  };

  const clearAllImages = () => {
    images.forEach(img => URL.revokeObjectURL(img.url));
    onImagesChange([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] bg-[#2c3e50] border-[#4a5568]">
        <DialogHeader>
          <DialogTitle className="text-[#ecf0f1] flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Display Image Manager
          </DialogTitle>
          <DialogDescription className="text-[#95a5a6]">
            Upload and manage images to display on the external quiz screen
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4">
          {/* Upload Area */}
          <Card className="bg-[#34495e] border-[#4a5568]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#ecf0f1] text-lg">Upload Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver 
                    ? 'border-[#f39c12] bg-[#f39c12]/10' 
                    : 'border-[#7f8c8d] hover:border-[#95a5a6]'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <ImageIcon className="w-12 h-12 mx-auto mb-4 text-[#95a5a6]" />
                <p className="text-[#ecf0f1] mb-2">Drag and drop images here, or click to select</p>
                <p className="text-sm text-[#95a5a6] mb-4">Supports JPG, PNG, GIF, WebP</p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#3498db] hover:bg-[#2980b9] text-white"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Select Images
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>

          {/* Image Grid */}
          <Card className="bg-[#34495e] border-[#4a5568] flex-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[#ecf0f1] text-lg">
                  Uploaded Images ({images.length})
                </CardTitle>
                {images.length > 0 && (
                  <Button
                    onClick={clearAllImages}
                    variant="destructive"
                    size="sm"
                    className="bg-[#e74c3c] hover:bg-[#c0392b]"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {images.length === 0 ? (
                  <div className="text-center py-12">
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 text-[#7f8c8d]" />
                    <p className="text-[#95a5a6]">No images uploaded yet</p>
                    <p className="text-sm text-[#7f8c8d]">Upload some images to display them on the external screen</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((image) => (
                      <div key={image.id} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-[#2c3e50] border border-[#4a5568]">
                          <ImageWithFallback
                            src={image.url}
                            alt={image.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <Button
                          onClick={() => removeImage(image.id)}
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#e74c3c] hover:bg-[#c0392b] w-8 h-8 p-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <p className="text-xs text-[#95a5a6] mt-2 truncate" title={image.name}>
                          {image.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="bg-[#34495e] border-[#4a5568]">
            <CardContent className="pt-4">
              <div className="text-sm text-[#95a5a6] space-y-1">
                <p><strong className="text-[#ecf0f1]">Instructions:</strong></p>
                <p>• Images will be displayed in a slideshow on the external display when enabled</p>
                <p>• Use the Display toggle button to show/hide the slideshow</p>
                <p>• Images will automatically cycle every 10 seconds</p>
                <p>• Supported formats: JPG, PNG, GIF, WebP</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}