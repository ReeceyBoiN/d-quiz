import { QuizHost } from "./components/QuizHost";
import { ExternalDisplayWindow } from "./components/ExternalDisplayWindow";
import React, { useEffect } from "react";
import { SettingsProvider } from "./utils/SettingsContext";
import { AuthProvider } from "./utils/AuthContext";
import { QuizDataProvider } from "./utils/QuizDataContext";
import { useQuizLoader } from "./utils/useQuizLoader";

function AppInner() {
  const { handleQuizFileSelection } = useQuizLoader();
  const isExternalDisplay = new URLSearchParams(window.location.search).get('external') === '1';

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
