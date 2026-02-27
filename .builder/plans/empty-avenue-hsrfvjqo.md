# Implementation Plan for Nearest Wins Cancel Button

## Problem Analysis
Currently, when the user clicks the "CANCEL" button in the `NearestWinsInterface` (or when `handleBackWithCleanup` invokes `onBack()`), the parent component (`QuizHost`) handles it by executing `handleNearestWinsClick()`. The `handleNearestWinsClick` function is actually meant to *open* the Nearest Wins interface (`setShowNearestWinsInterface(true)` and `setActiveTab("teams")`). So, the cancel button does not correctly return the user to the home screen because the wrong handler is bound to the `onBack` prop.

## Planned Changes

### 1. `src/components/QuizHost.tsx`
- Create a new function `handleNearestWinsClose` specifically for closing the Nearest Wins interface. This matches the pattern already established by `handleBuzzInClose` and `handleWheelSpinnerClose`.
  ```typescript
  // Handle nearest wins interface close
  const handleNearestWinsClose = () => {
    setShowNearestWinsInterface(false);
    setActiveTab("home"); // Return to home when nearest wins is closed
  };
  ```

- Update the `NearestWinsInterface` rendering to use this new close handler for the `onBack` prop instead of the `handleNearestWinsClick` handler:
  ```tsx
  // Find where showNearestWinsInterface is conditionally rendered:
  if (showNearestWinsInterface) {
    return (
      <div className="flex-1 overflow-hidden">
        <NearestWinsInterface
          teams={quizzes}
          onBack={handleNearestWinsClose} // <-- Replace handleNearestWinsClick here
          currentRoundWinnerPoints={currentRoundWinnerPoints}
          // ...
        />
      </div>
    );
  }
  ```

## Rationale
This approach properly cleanly isolates opening vs. closing of the Nearest Wins mode. `NearestWinsInterface` gracefully cleans up its own state with `handleBackWithCleanup` and calls the `onBack` callback; the parent then explicitly hides the UI and sets the application tab state back to `"home"`.
