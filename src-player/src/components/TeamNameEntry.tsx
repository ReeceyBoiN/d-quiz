import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface TeamNameEntryProps {
  onSubmit: (name: string) => void;
}

export function TeamNameEntry({ onSubmit }: TeamNameEntryProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a team name');
      return;
    }

    if (name.length > 50) {
      setError('Team name must be less than 50 characters');
      return;
    }

    onSubmit(name.trim());
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">PopQuiz</h1>
          <p className="text-slate-300 text-lg">Enter your team name to join</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="teamName" className="block text-white font-medium">
              Team Name
            </label>
            <Input
              id="teamName"
              type="text"
              placeholder="Enter team name..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              autoFocus
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Join Game
          </Button>
        </form>

        <p className="text-slate-400 text-sm text-center mt-6">
          Make sure you're connected to the same network as the host
        </p>
      </div>
    </div>
  );
}
