import React, { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Upload, X, Trash2, Image as ImageIcon, AlertCircle, HardDrive, GripVertical, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { projectImageStorage, StoredImage, formatFileSize, isValidImageFile, isValidImageSize } from "../utils/projectImageStorage";
import { toast } from "sonner";
// Note: Using native HTML5 drag and drop instead of react-dnd for better compatibility

interface PersistentImageManagerProps {
  onImagesChange: (images: StoredImage[]) => void;
  className?: string;
}

interface DragItem {
  id: string;
  index: number;
}

interface DraggableImageProps {
  image: StoredImage;
  index: number;
  moveImage: (dragIndex: number, hoverIndex: number) => void;
  onDelete: (id: string) => void;
}

const DraggableImage: React.FC<DraggableImageProps> = ({ image, index, moveImage, onDelete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: image.id, index }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (dragData.index !== index) {
        moveImage(dragData.index, index);
      }
    } catch (error) {
      console.error('Failed to parse drag data:', error);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative group bg-[#2c3e50] rounded-lg overflow-hidden border transition-all duration-200 cursor-move ${
        isDragging 
          ? 'opacity-50 scale-95 border-[#3498db] rotate-2' 
          : isOver 
            ? 'border-[#f39c12] scale-105 shadow-lg' 
            : 'border-[#4a5568] hover:border-[#3498db]'
      }`}
    >
      {/* Drag Handle */}
      <div className="absolute top-1 left-1 z-10 bg-black/60 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-3 h-3 text-white" />
      </div>
      
      {/* Order Badge */}
      <div className="absolute top-1 right-1 z-10 bg-[#3498db] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
        {index + 1}
      </div>
      
      <img
        src={image.url}
        alt={image.name}
        className="w-full h-20 object-cover"
        draggable={false}
      />
      
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(image.id)}
          className="text-white hover:text-[#e74c3c] hover:bg-[#e74c3c]/20"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="text-xs text-white truncate" title={image.name}>
          {image.name}
        </div>
        <div className="text-xs text-[#95a5a6]">
          {formatFileSize(image.size)}
        </div>
      </div>
    </div>
  );
};

export function PersistentImageManager({ onImagesChange, className = "" }: PersistentImageManagerProps) {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ used: 0, available: 0, imageCount: 0 });
  const [dragOver, setDragOver] = useState(false);

  // Load images from IndexedDB on component mount
  useEffect(() => {
    loadImages();
    updateStorageInfo();
  }, []);

  const loadImages = async () => {
    try {
      // Try to migrate from IndexedDB if needed
      await projectImageStorage.migrateFromIndexedDB();
      
      const storedImages = await projectImageStorage.getAllImages();
      setImages(storedImages);
      onImagesChange(storedImages);
    } catch (error) {
      console.error('Failed to load images:', error);
      toast.error('Failed to load stored images');
    }
  };

  const updateStorageInfo = async () => {
    try {
      const info = await projectImageStorage.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Failed to get storage info:', error);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;

    setUploading(true);
    const uploadedImages: StoredImage[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!isValidImageFile(file)) {
        errors.push(`${file.name}: Invalid file type`);
        continue;
      }

      // Validate file size (2MB limit for localStorage efficiency)
      if (!isValidImageSize(file)) {
        errors.push(`${file.name}: File too large (max 2MB)`);
        continue;
      }

      try {
        const storedImage = await projectImageStorage.saveImage(file);
        uploadedImages.push(storedImage);
      } catch (error) {
        errors.push(`${file.name}: Upload failed`);
        console.error('Failed to save image:', error);
      }
    }

    if (uploadedImages.length > 0) {
      const newImages = [...images, ...uploadedImages];
      setImages(newImages);
      onImagesChange(newImages);
      toast.success(`Added ${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''}`);
    }

    if (errors.length > 0) {
      toast.error(`Failed to upload ${errors.length} file${errors.length > 1 ? 's' : ''}`);
    }

    setUploading(false);
    updateStorageInfo();
  };

  const handleDelete = async (imageId: string) => {
    try {
      await projectImageStorage.deleteImage(imageId);
      const newImages = images.filter(img => img.id !== imageId);
      setImages(newImages);
      onImagesChange(newImages);
      updateStorageInfo();
      toast.success('Image deleted');
    } catch (error) {
      console.error('Failed to delete image:', error);
      toast.error('Failed to delete image');
    }
  };

  const handleClearAll = async () => {
    if (images.length === 0) return;
    
    try {
      await projectImageStorage.clearAllImages();
      setImages([]);
      onImagesChange([]);
      updateStorageInfo();
      toast.success('All images cleared');
    } catch (error) {
      console.error('Failed to clear images:', error);
      toast.error('Failed to clear images');
    }
  };

  const moveImage = useCallback(async (dragIndex: number, hoverIndex: number) => {
    const newImages = [...images];
    const draggedImage = newImages[dragIndex];
    
    // Remove the dragged item and insert it at the new position
    newImages.splice(dragIndex, 1);
    newImages.splice(hoverIndex, 0, draggedImage);
    
    setImages(newImages);
    onImagesChange(newImages);
    
    // Update the order in storage
    try {
      await projectImageStorage.updateImageOrder(newImages);
    } catch (error) {
      console.error('Failed to update image order:', error);
      toast.error('Failed to save new order');
    }
  }, [images, onImagesChange]);

  const moveImageUp = async (index: number) => {
    if (index > 0) {
      await moveImage(index, index - 1);
    }
  };

  const moveImageDown = async (index: number) => {
    if (index < images.length - 1) {
      await moveImage(index, index + 1);
    }
  };

  const resetOrder = async () => {
    try {
      await projectImageStorage.resetOrder();
      // Reload images to get the updated order
      await loadImages();
      updateStorageInfo();
      toast.success('Order reset to upload date');
    } catch (error) {
      console.error('Failed to reset order:', error);
      toast.error('Failed to reset order');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }, [images]);

  const storageUsedPercent = storageInfo.available > 0 
    ? Math.min((storageInfo.used / (storageInfo.used + storageInfo.available)) * 100, 100) 
    : 0;

  return (
    <div className={`bg-[#34495e] rounded-lg border border-[#4a5568] ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-[#4a5568]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#3498db]" />
            <h3 className="text-lg font-semibold text-[#ecf0f1]">Image Storage</h3>
            <Badge variant="secondary" className="text-xs">
              {images.length} image{images.length !== 1 ? 's' : ''}
            </Badge>
            {/* Project storage indicator */}
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Project Storage Active"></div>
              <span className="text-xs text-[#27ae60]">Project Storage</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetOrder}
              disabled={images.length === 0}
              className="text-[#f39c12] border-[#f39c12] hover:bg-[#f39c12] hover:text-white"
              title="Reset order to upload date"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset Order
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={images.length === 0}
              className="text-[#e74c3c] border-[#e74c3c] hover:bg-[#e74c3c] hover:text-white"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Storage Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-[#95a5a6]">
              <HardDrive className="w-4 h-4" />
              Storage Used
            </div>
            <span className="text-[#ecf0f1]">
              {formatFileSize(storageInfo.used)} / {formatFileSize(storageInfo.used + storageInfo.available)}
            </span>
          </div>
          <Progress value={storageUsedPercent} className="h-2" />
          {storageUsedPercent > 80 && (
            <div className="flex items-center gap-2 text-[#f39c12] text-xs">
              <AlertCircle className="w-3 h-3" />
              Storage space running low
            </div>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <div className="p-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer ${
            dragOver
              ? 'border-[#3498db] bg-[#3498db]/10 scale-105'
              : uploading
                ? 'border-[#f39c12] bg-[#f39c12]/10'
                : 'border-[#7f8c8d] hover:border-[#95a5a6] hover:bg-[#4a5568]/30 hover:scale-[1.02]'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            id="image-upload"
            disabled={uploading}
          />
          <label htmlFor="image-upload" className="cursor-pointer block">
            <Upload className={`w-12 h-12 mx-auto mb-4 ${
              dragOver ? 'text-[#3498db] animate-bounce' : 
              uploading ? 'text-[#f39c12] animate-spin' :
              'text-[#7f8c8d]'
            }`} />
            <p className="text-[#ecf0f1] font-semibold mb-2 text-lg">
              {uploading ? 'Uploading Images...' : 'Upload Slideshow Images'}
            </p>
            <p className="text-[#95a5a6] text-sm mb-3">
              Drag & drop files here or click to browse
            </p>
            <div className="text-xs text-[#7f8c8d] space-y-1">
              <div>📄 Supported: PNG, JPG, GIF, WebP</div>
              <div>🔄 Multiple files supported</div>
              <div>💾 Stored in project (persists across sessions)</div>
            </div>
          </label>
        </div>
      </div>

      {/* Images Grid */}
      {images.length > 0 && (
        <div className="px-4 pb-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-[#ecf0f1]">Display Order</h4>
              <div className="text-xs text-[#95a5a6]">
                Drag to reorder • First image = {images.length > 0 ? '1st to display' : 'none'}
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-80 overflow-y-auto">
              {images.map((image, index) => (
                <DraggableImage
                  key={image.id}
                  image={image}
                  index={index}
                  moveImage={moveImage}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            
            {/* Quick Controls */}
            <div className="flex gap-2 justify-center pt-3 border-t border-[#4a5568]">
              <div className="text-xs text-[#95a5a6] text-center space-y-1">
                <div>💡 <strong>Drag & Drop:</strong> Drag images to reorder the slideshow sequence</div>
                <div>🔢 <strong>Order:</strong> Blue badges show current position (1st image displays first)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && !uploading && (
        <div className="p-8 text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-[#7f8c8d]" />
          <p className="text-[#95a5a6] mb-2">No images stored</p>
          <p className="text-sm text-[#7f8c8d]">
            Upload images to use in slideshow mode
          </p>
        </div>
      )}
    </div>
  );
}
