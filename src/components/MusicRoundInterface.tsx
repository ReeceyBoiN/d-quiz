import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Folder, FolderOpen, Music, Upload, X, FileAudio } from "lucide-react";
import { getMusicRoundsPath, listDirectory, type FileEntry } from "../utils/fileBrowser";

interface MusicRoundInterfaceProps {
  onClose: () => void;
}

type SortOrder = "name" | "newest" | "oldest";

const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".flac"];

function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function MusicRoundInterface({ onClose }: MusicRoundInterfaceProps) {
  const [rootPath, setRootPath] = useState<string>("");
  const [folders, setFolders] = useState<FileEntry[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FileEntry | null>(null);
  const [folderContents, setFolderContents] = useState<FileEntry[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the root Music Rounds path and its folders
  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const path = await getMusicRoundsPath();
      setRootPath(path);
      const entries = await listDirectory(path);
      // Only show directories
      const dirs = entries.filter((e) => e.isDirectory);
      setFolders(dirs);
    } catch (err: any) {
      console.error("[MusicRound] Failed to load Music Rounds path:", err);
      setError("Could not load Music Rounds folder.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // Load contents of the selected folder
  useEffect(() => {
    if (!selectedFolder) {
      setFolderContents([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const entries = await listDirectory(selectedFolder.path);
        if (!cancelled) {
          // Filter to audio files only
          const audioFiles = entries.filter(
            (e) => !e.isDirectory && isAudioFile(e.name)
          );
          setFolderContents(audioFiles);
        }
      } catch (err) {
        console.error("[MusicRound] Failed to list folder contents:", err);
        if (!cancelled) setFolderContents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedFolder]);

  // Sort folders based on selected order
  const sortedFolders = [...folders].sort((a, b) => {
    switch (sortOrder) {
      case "name":
        return a.name.localeCompare(b.name);
      case "newest":
        return b.name.localeCompare(a.name); // Fallback: reverse alpha without stat info
      case "oldest":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  // Handle adding audio files via browser file picker
  const handleAddAudioFiles = async () => {
    try {
      const w = window as any;
      if (w?.showOpenFilePicker) {
        const handles = await w.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: "Audio Files",
              accept: {
                "audio/*": [".mp3", ".m4a", ".wav", ".ogg", ".flac"],
              },
            },
          ],
        });
        if (handles && handles.length > 0) {
          console.log("[MusicRound] Selected", handles.length, "audio files");
          // In browser mode, we can't write to the filesystem directly
          // In Electron, this would use IPC to copy files
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("[MusicRound] File picker error:", err);
      }
    }
  };

  // Get display path for the breadcrumb
  const displayPath = rootPath
    ? "/PopQuiz/Music Rounds/"
    : "/Music Rounds/";

  return (
    <div className="flex-1 h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Music className="h-5 w-5 text-[rgba(255,127,39,1)]" />
          <h2 className="text-lg font-semibold text-card-foreground">
            Music Round
          </h2>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Left: Folder browser */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-card-foreground">
                Select a folder
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {/* Path display */}
              <div className="text-xs text-muted-foreground mb-2 font-mono">
                {displayPath}
              </div>

              {/* Sort options */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Order by
                </span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    checked={sortOrder === "name"}
                    onChange={() => setSortOrder("name")}
                    className="accent-primary w-3 h-3"
                  />
                  <span className="text-xs text-card-foreground">Name</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    checked={sortOrder === "newest"}
                    onChange={() => setSortOrder("newest")}
                    className="accent-primary w-3 h-3"
                  />
                  <span className="text-xs text-card-foreground">Newest</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    checked={sortOrder === "oldest"}
                    onChange={() => setSortOrder("oldest")}
                    className="accent-primary w-3 h-3"
                  />
                  <span className="text-xs text-card-foreground">Oldest</span>
                </label>
              </div>

              {/* Folder list */}
              <div className="border border-border rounded bg-background min-h-[200px] max-h-[300px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    Loading...
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center h-[200px] text-destructive text-sm">
                    {error}
                  </div>
                ) : sortedFolders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground text-sm gap-2">
                    <Folder className="h-8 w-8 opacity-40" />
                    <span>No folders found</span>
                    <span className="text-xs">
                      Create folders inside Music Rounds
                    </span>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {sortedFolders.map((folder) => (
                      <button
                        key={folder.path}
                        onClick={() => setSelectedFolder(folder)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                          selectedFolder?.path === folder.path
                            ? "bg-accent text-accent-foreground"
                            : "text-card-foreground"
                        }`}
                      >
                        {selectedFolder?.path === folder.path ? (
                          <FolderOpen className="h-4 w-4 text-[rgba(255,127,39,1)] flex-shrink-0" />
                        ) : (
                          <Folder className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        )}
                        <span className="truncate">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: Import panel */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-card-foreground">
                Import audio files from your computer
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Button
                onClick={handleAddAudioFiles}
                className="bg-[rgba(255,127,39,1)] hover:bg-[rgba(204,85,0,1)] text-white font-semibold px-6 py-2 mb-3"
              >
                <Music className="h-4 w-4 mr-2" />
                Add Audio Files
              </Button>
              <p className="text-xs text-muted-foreground">
                Browse your computer for audio files (mp3, m4a or wav).
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Add folders containing your music round songs to the Music
                Rounds directory, then select a folder from the list on the left
                to load it as a round.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bottom: Selected folder contents */}
        <Card className="bg-card border-border">
          <CardContent className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              {selectedFolder ? (
                <FolderOpen className="h-4 w-4 text-[rgba(255,127,39,1)]" />
              ) : (
                <Folder className="h-4 w-4 text-yellow-500" />
              )}
              <span className="text-sm font-semibold text-card-foreground">
                {selectedFolder ? selectedFolder.name : "No folder selected"}
              </span>
            </div>

            <div className="border border-border rounded bg-background min-h-[150px] max-h-[250px] overflow-y-auto">
              {!selectedFolder ? (
                <div className="flex items-center justify-center h-[150px] text-muted-foreground text-sm">
                  Select a folder to view its audio files
                </div>
              ) : folderContents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[150px] text-muted-foreground text-sm gap-1">
                  <FileAudio className="h-6 w-6 opacity-40" />
                  <span>No audio files in this folder</span>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {folderContents.map((file, index) => (
                    <div
                      key={file.path}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-card-foreground"
                    >
                      <span className="text-xs text-muted-foreground w-6 text-right">
                        {index + 1}.
                      </span>
                      <FileAudio className="h-4 w-4 text-[rgba(255,127,39,1)] flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer with Close button */}
      <div className="flex justify-end px-6 py-3 border-t border-border bg-card">
        <Button
          onClick={onClose}
          variant="outline"
          className="px-6"
        >
          <X className="h-4 w-4 mr-2" />
          Close
        </Button>
      </div>
    </div>
  );
}
