import { QuizHost } from "./components/QuizHost";
import { SettingsProvider } from "./utils/SettingsContext";
import { AuthProvider } from "./utils/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <QuizHost />
      </SettingsProvider>
    </AuthProvider>
  );
}