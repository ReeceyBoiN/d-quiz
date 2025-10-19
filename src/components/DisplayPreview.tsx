import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface DisplayPreviewProps {
  className?: string;
}

export function DisplayPreview({ className = "" }: DisplayPreviewProps) {
  return (
    <Card className={`bg-[#34495e]/60 border-[#4a5568]/40 backdrop-blur-sm ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-[#ecf0f1]/80 text-center text-lg font-semibold">
          QUIZ DISPLAY PREVIEW
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-[#2c3e50]/80 rounded-lg p-8 h-full flex items-center justify-center border-2 border-[#4a5568]/30">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 border-4 border-[#3498db]/60 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h3 className="text-xl text-[#ecf0f1]/80 font-semibold">Loading Quiz Display</h3>
            <p className="text-[#95a5a6]/70 text-sm max-w-md">
              The quiz display will appear here. This preview shows what participants will see on their screens.
            </p>
            <div className="text-xs text-[#7f8c8d]/60 pt-2">
              Preview • Resolution: 1920x1080 • 16:9 Aspect Ratio
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}