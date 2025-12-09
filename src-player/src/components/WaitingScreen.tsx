interface WaitingScreenProps {
  teamName: string;
}

export function WaitingScreen({ teamName }: WaitingScreenProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-white mb-4">
          Waiting Room
        </h2>
        <p className="text-xl text-slate-300 mb-8">{teamName}</p>
        <div className="space-y-4">
          <p className="text-slate-400 text-lg">
            Waiting for Quiz Host
          </p>
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
