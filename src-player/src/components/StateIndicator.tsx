import { AlertCircle, Wifi, WifiOff, Loader } from 'lucide-react';

export type QuestionState = 'waiting' | 'ready' | 'shown' | 'answered' | 'revealed' | 'next-waiting' | 'no-connection';

interface StateIndicatorProps {
  state: QuestionState;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
}

export function StateIndicator({ state, connectionStatus = 'connected' }: StateIndicatorProps) {
  const getStateMessage = (): { icon: JSX.Element; text: string; color: string } => {
    switch (state) {
      case 'waiting':
        return {
          icon: <Loader className="w-4 h-4 animate-spin" />,
          text: 'Waiting for question...',
          color: 'text-slate-400',
        };
      case 'ready':
        return {
          icon: <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse" />,
          text: 'Input method ready',
          color: 'text-blue-400',
        };
      case 'shown':
        return {
          icon: <div className="w-4 h-4 bg-cyan-400 rounded-full" />,
          text: 'Question displayed',
          color: 'text-cyan-400',
        };
      case 'answered':
        return {
          icon: <div className="w-4 h-4 bg-green-400 rounded-full" />,
          text: 'Answer submitted',
          color: 'text-green-400',
        };
      case 'revealed':
        return {
          icon: <div className="w-4 h-4 bg-amber-400 rounded-full" />,
          text: 'Answer revealed',
          color: 'text-amber-400',
        };
      case 'next-waiting':
        return {
          icon: <Loader className="w-4 h-4 animate-spin" />,
          text: 'Loading next question...',
          color: 'text-slate-400',
        };
      case 'no-connection':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: 'No connection to host',
          color: 'text-red-400',
        };
      default:
        return {
          icon: <div className="w-4 h-4 bg-slate-500 rounded-full" />,
          text: 'Unknown state',
          color: 'text-slate-400',
        };
    }
  };

  const stateInfo = getStateMessage();

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-700/50 rounded-lg">
      <div className={stateInfo.color}>{stateInfo.icon}</div>
      <span className={`text-xs ${stateInfo.color}`}>{stateInfo.text}</span>

      {connectionStatus === 'disconnected' && (
        <div className="ml-auto flex items-center gap-1 text-red-400">
          <WifiOff className="w-3 h-3" />
          <span className="text-xs">Offline</span>
        </div>
      )}
      {connectionStatus === 'connecting' && (
        <div className="ml-auto flex items-center gap-1 text-yellow-400">
          <Wifi className="w-3 h-3 animate-pulse" />
          <span className="text-xs">Reconnecting...</span>
        </div>
      )}
    </div>
  );
}
