# Team Photo Upload Debug Plan - Issue Identified

## Confirmed Behavior
✅ SettingsBar is visible  
✅ Upload Photo button is visible and clickable  
✅ File picker dialog opens when button is clicked  
❌ After selecting a file, nothing happens (no console log, no image preview, no error)

## Root Cause: The onChange Handler is Not Firing or Failing Silently

The file input `onChange={handlePhotoUpload}` is either:
1. Not being triggered when a file is selected, OR
2. Being triggered but failing silently inside the handler

## Missing Error Handler
The code has a try/catch around FileReader creation, but **FileReader.readAsDataURL is asynchronous and errors won't be caught**. The code is missing `reader.onerror` handler.

## Fix Required: Add Comprehensive Logging

### Phase 1: Add Logging to Confirm onChange is Firing
Add console.log at the very start of handlePhotoUpload to confirm the function is called when a file is selected.

### Phase 2: Add FileReader Error Handler
Add `reader.onerror` to catch if readAsDataURL fails.

### Phase 3: Add Logging at Each Step
- Log file selection
- Log file size validation
- Log FileReader creation
- Log readAsDataURL call
- Log onload event
- Log updateTeamPhoto call
- Log updateTeamPhoto result

## Implementation Details

**File to modify:** `src-player/src/components/SettingsBar.tsx`

**In handlePhotoUpload function, change from:**
```tsx
const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 500 * 1024 * 1024) {
    console.error('[SettingsBar] File size exceeds 500MB limit');
    alert('File size exceeds 500MB limit');
    return;
  }

  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateTeamPhoto(base64);
      console.log('[SettingsBar] Team photo uploaded and saved');
    };
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('[SettingsBar] Error uploading photo:', error);
    alert('Error uploading photo');
  }
};
```

**To:**
```tsx
const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  console.log('[SettingsBar] handlePhotoUpload called');
  const file = event.target.files?.[0];
  console.log('[SettingsBar] File selected:', file?.name, file?.size, file?.type);
  if (!file) {
    console.log('[SettingsBar] No file selected, returning');
    return;
  }

  console.log('[SettingsBar] File size check:', file.size);
  if (file.size > 500 * 1024 * 1024) {
    console.error('[SettingsBar] File size exceeds 500MB limit:', file.size);
    alert('File size exceeds 500MB limit');
    return;
  }

  try {
    console.log('[SettingsBar] Creating FileReader...');
    const reader = new FileReader();
    
    reader.onload = (e) => {
      console.log('[SettingsBar] FileReader onload fired');
      const base64 = e.target?.result as string;
      console.log('[SettingsBar] Base64 data received, length:', base64?.length);
      updateTeamPhoto(base64);
      console.log('[SettingsBar] Team photo uploaded and saved');
    };

    reader.onerror = (error) => {
      console.error('[SettingsBar] FileReader error:', error);
      alert('Error reading file');
    };

    console.log('[SettingsBar] Calling readAsDataURL...');
    reader.readAsDataURL(file);
    console.log('[SettingsBar] readAsDataURL called successfully');
  } catch (error) {
    console.error('[SettingsBar] Error uploading photo:', error);
    alert('Error uploading photo');
  }
};
```

## Expected Result After Fix
When user selects a file, they will see in console:
```
[SettingsBar] handlePhotoUpload called
[SettingsBar] File selected: photo.jpg 250000 image/jpeg
[SettingsBar] File size check: 250000
[SettingsBar] Creating FileReader...
[SettingsBar] Calling readAsDataURL...
[SettingsBar] readAsDataURL called successfully
[SettingsBar] FileReader onload fired
[SettingsBar] Base64 data received, length: 250000
[SettingsBar] Team photo uploaded and saved
```

This will identify exactly where the process is failing.
