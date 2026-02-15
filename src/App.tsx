import { QuizHost } from "./components/QuizHost";
import { ExternalDisplayWindow } from "./components/ExternalDisplayWindow";
import React, { useEffect } from "react";
import { SettingsProvider, useSettings } from "./utils/SettingsContext";
import { AuthProvider } from "./utils/AuthContext";
import { QuizDataProvider } from "./utils/QuizDataContext";
import { useQuizLoader } from "./utils/useQuizLoader";
import { initHostNetwork } from "./network/wsHost";

function AppInner() {
  const { handleQuizFileSelection } = useQuizLoader();
  const { buzzerFolderPath } = useSettings();
  const isExternalDisplay = new URLSearchParams(window.location.search).get('external') === '1';

  useEffect(() => {
    initHostNetwork({ enabled: true });
  }, []);

  // Sync saved buzzer folder path to backend on app startup
  useEffect(() => {
    const syncBuzzerFolderPathToBackend = async () => {
      try {
        // First, ensure app is ready
        await (window as any).api?.appReady?.();

        // Read the saved buzzer folder path from localStorage
        const savedSettings = localStorage.getItem('quizHostSettings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          const savedPath = parsed.buzzerFolderPath;

          if (savedPath) {
            console.log('[App] Syncing saved buzzer folder path to backend:', savedPath);
            // Call IPC to sync the path to backend
            try {
              const result = await (window as any).api?.ipc?.invoke?.('buzzer/update-folder-path', { folderPath: savedPath });
              if (result?.ok) {
                console.log('[App] ✅ Successfully synced buzzer folder path to backend');
              } else {
                console.warn('[App] Failed to sync buzzer folder path - backend may not be ready yet');
              }
            } catch (err) {
              console.warn('[App] Error syncing buzzer folder path to backend:', err);
            }
          }
        }
      } catch (err) {
        console.warn('[App] Error during startup sync:', err);
      }
    };

    syncBuzzerFolderPathToBackend();
  }, []);

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) || null;
      if (!file) return;
      const name = file.name || "";
      if (/\.(sqq|sqn|sqb)$/i.test(name)) {
        handleQuizFileSelection(file);
      }
    };

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [handleQuizFileSelection]);

  if (isExternalDisplay) {
    return <ExternalDisplayWindow />;
  }

  return <QuizHost />;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <QuizDataProvider>
          <AppInner />
        </QuizDataProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
