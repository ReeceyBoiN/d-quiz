import { CheckCircle } from 'lucide-react';

interface WaitingScreenProps {
  teamName: string;
}

export function WaitingScreen({ teamName }: WaitingScreenProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="mb-6">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Team Registered</h1>
          <p className="text-xl text-slate-300">{teamName}</p>
        </div>

        <div className="mt-8 space-y-4">
          <p className="text-slate-400">Waiting for the host to start the quiz...</p>
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
