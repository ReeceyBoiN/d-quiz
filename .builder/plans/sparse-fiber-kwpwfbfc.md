# Wheel Spinner Presets & Custom Wheel Types System

## Overview
Implement a comprehensive system allowing users to:
1. **Create custom wheel type definitions** with configurable options/segments
2. **Save wheel type definitions to files** for backup and sharing
3. **Load wheel type definitions from files** so they appear in the contentType dropdown
4. **Manage wheel type definitions** (edit, delete, rename)
5. **Create wheel instances from saved types** and save instance presets

## Feature Breakdown

### Part 1: Custom Wheel Type Definitions
Users can create new wheel content types beyond the current "Teams", "Random Points", and "Custom".

**What gets saved:**
```
WheelTypeDefinition {
  id: string              // unique identifier (e.g., "difficulty-levels-2024")
  name: string            // display name (e.g., "Difficulty Levels")
  description?: string    // optional description
  items: WheelTypeItem[]  // array of option objects
  createdAt: number       // timestamp
  version: number         // for future compatibility
}

WheelTypeItem {
  id: string      // unique within type
  label: string   // display text (e.g., "Easy", "Medium", "Hard")
  value?: string  // optional associated value
}
```

**Storage:**
- Store in localStorage under key `wheelTypeDefinitions` as JSON array
- Alternatively, allow export to `.wtype.json` files and import them back
- Keep in-memory cache of loaded definitions in a new context or utility

### Part 2: Wheel Instance Presets
Users can save configured wheel instances (combinations of content type + options + settings).

**What gets saved:**
```
WheelPreset {
  id: string
  name: string                          // user-friendly name
  wheelTypeId: string                   // reference to which type this preset uses
  contentType: 'custom-type' | 'teams' | 'random-points' | 'custom'
  customItems?: WheelTypeItem[]         // for non-predefined types
  customPointValues?: number[]          // for random-points type
  removedItems?: string[]               // excluded items (saved but reset on load per requirements)
  createdAt: number
  updatedAt: number
}
```

**Storage:**
- Store in localStorage under key `wheelPresets` as JSON array
- Allow export to `.wpreset.json` files

### Part 3: UI Components & Interactions

#### A. Wheel Type Manager (New)
Location: New modal/dialog or sidebar panel accessible from WheelSpinnerInterface
Responsibilities:
- Display list of loaded wheel type definitions
- Create new wheel type (name + add items with labels)
- Edit wheel type (modify items, name, description)
- Delete wheel type
- Import wheel type from file
- Export wheel type to file

UI Elements:
- "Manage Wheel Types" button in WheelSpinnerInterface header
- Modal showing:
  - List of existing wheel types with edit/delete/export buttons
  - "Create New Type" button
  - "Import Type from File" button
- Create/Edit dialog:
  - Text input for name & description
  - Table/list to add/remove/edit items
  - Save & Cancel buttons

#### B. Enhanced WheelSpinnerInterface
Modifications to existing component:
1. **Content type dropdown** - dynamically populated with:
   - "Teams" (system type)
   - "Random Points" (system type)
   - "Custom" (system type)
   - All loaded custom wheel type definitions
2. **Preset management toolbar** (left panel):
   - Save Preset button → modal with name input
   - Load Preset dropdown → select from saved presets
   - Delete Preset button (appears when preset is loaded)
   - Edit Preset button (when preset is loaded) → "Save" or "Save As New"
3. **Responsive behavior**:
   - When user selects a custom wheel type, populate items from that type definition
   - When user loads a preset, restore all settings and call onExternalDisplayUpdate
   - When user saves/edits, persist to localStorage and fire update event

### Part 4: Storage & Persistence Strategy

#### Local Storage Structure:
```javascript
// Wheel type definitions
localStorage['wheelTypeDefinitions'] = JSON.stringify([
  {
    id: "difficulty-2024",
    name: "Difficulty Levels",
    items: [{ id: "easy", label: "Easy" }, { id: "med", label: "Medium" }, ...],
    createdAt: 1708123456789,
    version: 1
  },
  ...
])

// Wheel instance presets
localStorage['wheelPresets'] = JSON.stringify([
  {
    id: "preset-1",
    name: "Quiz Night Bonuses",
    wheelTypeId: "custom",
    contentType: "custom",
    customItems: [...],
    createdAt: ...,
    updatedAt: ...
  },
  ...
])
```

#### File Export/Import:
- **Wheel type files** (`.wtype.json`): Contains single WheelTypeDefinition
  - User can export a wheel type definition to share/backup
  - User can import to add it to their definitions list
- **Preset files** (`.wpreset.json`): Contains single WheelPreset
  - User can export a preset to share
  - User can import to add to their presets list

### Part 5: Implementation Files & Changes

#### New Files to Create:
1. **`src/utils/wheelTypeStorage.ts`**
   - Utility class for managing wheel type definitions
   - Methods: loadAll(), create(), update(), delete(), export(), import()
   - Uses localStorage with key `wheelTypeDefinitions`

2. **`src/utils/wheelPresetStorage.ts`**
   - Utility class for managing wheel instance presets
   - Methods: loadAll(), create(), update(), delete(), export(), import()
   - Uses localStorage with key `wheelPresets`

3. **`src/components/WheelTypeManager.tsx`** (Optional or embedded in existing modal)
   - Modal/Panel for creating, editing, deleting wheel type definitions
   - Import/Export UI for wheel types
   - List display with actions

4. **`src/components/dialogs/SaveWheelPresetDialog.tsx`** (Optional)
   - Dialog for saving current wheel configuration as a preset

#### Modified Files:
1. **`src/components/WheelSpinnerInterface.tsx`**
   - Add state for loaded wheel types
   - Dynamically populate contentType dropdown with loaded types
   - Add "Manage Wheel Types" button & modal
   - Add preset toolbar: Save, Load, Delete, Edit buttons
   - Hook up preset loading/saving to storage utilities
   - Call onExternalDisplayUpdate after loading preset or changing wheel type

2. **`src/utils/SettingsContext.tsx`** (Optional)
   - Optionally expose wheel type/preset APIs via context for global access
   - Or keep utilities standalone and imported where needed

3. **`src/components/ExternalDisplayWindow.tsx`**
   - No changes needed (already receives wheelItems from WheelSpinnerInterface)

### Part 6: User Workflow Examples

#### Example 1: Create & Save a Difficulty Wheel Type
1. User clicks "Manage Wheel Types"
2. Modal opens, user clicks "Create New Type"
3. User enters name: "Difficulty Levels" and description
4. User adds items: "Easy", "Medium", "Hard", "Expert"
5. User clicks Save → type is created and stored in localStorage
6. Modal closes, "Difficulty Levels" now appears in contentType dropdown
7. User can now select "Difficulty Levels" to populate the wheel
8. User can export this type as `.wtype.json` file to backup or share

#### Example 2: Create & Save a Wheel Preset
1. User selects "Difficulty Levels" from contentType dropdown
2. Wheel populates with Easy, Medium, Hard, Expert
3. User customizes colors, order, or removes some items
4. User clicks "Save Preset" → dialog asks for preset name
5. User enters "Quiz Game 1" → preset is saved to localStorage
6. Later, user can click "Load Preset" → "Quiz Game 1" appears in dropdown
7. Selecting it restores the wheel configuration instantly
8. User can "Save As New" to create a variant, or "Update" to overwrite the loaded preset
9. User can delete presets via "Delete Preset" button

#### Example 3: Import a Shared Wheel Type
1. User receives `bonus-tiers.wtype.json` file from colleague
2. User clicks "Manage Wheel Types" → "Import Type from File"
3. User selects the file
4. System validates and adds "Bonus Tiers" to their list
5. "Bonus Tiers" now appears in contentType dropdown

### Part 7: Technical Considerations

1. **Backward Compatibility**
   - System types ("Teams", "Random Points", "Custom") remain unchanged
   - Custom wheel types are additive and don't interfere

2. **Data Validation**
   - Validate wheel type definitions on import (required fields, no duplicate IDs within type)
   - Validate presets reference valid wheel types (gracefully handle missing types)

3. **External Display Sync**
   - WheelSpinnerInterface already calls onExternalDisplayUpdate when wheel state changes
   - Ensure this is called when loading presets or changing wheel types
   - External display receives standard wheelItems array (no changes needed)

4. **Error Handling**
   - Gracefully handle localStorage quota exceeded (warn user, suggest cleanup)
   - Handle corrupted JSON in localStorage (fallback to empty array)
   - Handle missing files on import with user-friendly error messages

5. **Performance**
   - Load all wheel types on app startup (should be small JSON, no performance concern)
   - Cache in-memory for quick lookups
   - Lazy load presets only when needed (or load all on startup, same logic)

### Part 8: Testing Checklist (Reference)
- Create a wheel type with multiple items
- Save and load a wheel type
- Export/import a wheel type file
- Create a wheel preset with a custom type
- Save and load a wheel preset
- Edit a loaded preset and save as new vs. update
- Delete wheel types and presets
- Verify external display updates when loading presets
- Verify removal of items is reset (not persisted) when loading preset
- Test edge cases: missing types, quota exceeded, corrupted files

## Summary
This implementation gives users full control over creating reusable wheel definitions and saving specific wheel configurations as presets. The system is extensible, localStorage-based (consistent with the app), and maintains compatibility with existing wheel types.
