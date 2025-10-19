import { X, Minus, Square } from "lucide-react";

export function WindowControls() {
  const handleClose = () => {
    // Handle close functionality
    console.log("Close clicked");
  };

  const handleMinimize = () => {
    // Handle minimize functionality
    console.log("Minimize clicked");
  };

  const handleMaximize = () => {
    // Handle maximize functionality
    console.log("Maximize clicked");
  };

  return (
    <div className="flex items-center gap-2 absolute top-2 left-2 z-50">
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="w-6 h-6 rounded-full bg-gray-600 hover:bg-red-500 flex items-center justify-center transition-colors duration-200 group"
      >
        <X className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </button>
      
      {/* Minimize Button */}
      <button
        onClick={handleMinimize}
        className="w-6 h-6 rounded-full bg-gray-600 hover:bg-blue-500 flex items-center justify-center transition-colors duration-200 group"
      >
        <Minus className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </button>
      
      {/* Maximize Button */}
      <button
        onClick={handleMaximize}
        className="w-6 h-6 rounded-full bg-gray-600 hover:bg-blue-500 flex items-center justify-center transition-colors duration-200 group"
      >
        <Square className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </button>
    </div>
  );
}