export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex flex-col items-center gap-8">
        {/* Main Title */}
        <div className="text-center">
          <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-2">
            Pop Quiz
          </h1>
          <div className="h-1 w-24 mx-auto bg-gradient-to-r from-blue-400 to-purple-400 rounded-full" />
        </div>

        {/* Loading Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-3 h-3 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-3 h-3 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
          <span className="text-slate-400 text-sm font-medium">Loading next question...</span>
        </div>

        {/* Subtle secondary text */}
        <p className="text-slate-500 text-sm mt-8 text-center max-w-xs">
          Get ready for the next question
        </p>
      </div>
    </div>
  );
}
