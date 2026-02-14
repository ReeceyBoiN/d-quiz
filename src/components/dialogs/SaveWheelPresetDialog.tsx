import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { wheelPresetStorage, WheelContentType, WheelPreset } from '../../utils/wheelPresetStorage';
import { WheelTypeItem } from '../../utils/wheelTypeStorage';

interface SaveWheelPresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: WheelContentType;
  customItems?: WheelTypeItem[];
  customPointValues?: number[];
  wheelTypeId?: string;
  existingPresetId?: string; // If editing an existing preset
  onSaveSuccess?: (preset: WheelPreset) => void;
}

export function SaveWheelPresetDialog({
  open,
  onOpenChange,
  contentType,
  customItems,
  customPointValues,
  wheelTypeId,
  existingPresetId,
  onSaveSuccess,
}: SaveWheelPresetDialogProps) {
  const [presetName, setPresetName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<'new' | 'update'>('new');

  React.useEffect(() => {
    if (open) {
      setError(null);
      if (existingPresetId) {
        setSaveMode('update');
        const preset = wheelPresetStorage.getById(existingPresetId);
        if (preset) {
          setPresetName(preset.name);
        }
      } else {
        setSaveMode('new');
        setPresetName('');
      }
    }
  }, [open, existingPresetId]);

  const handleSave = () => {
    if (!presetName.trim()) {
      setError('Preset name is required');
      return;
    }

    try {
      let preset: WheelPreset | null = null;

      if (saveMode === 'update' && existingPresetId) {
        preset = wheelPresetStorage.update(existingPresetId, {
          name: presetName.trim(),
          contentType,
          customItems,
          customPointValues,
          wheelTypeId,
          removedItems: [],
        });
      } else {
        preset = wheelPresetStorage.create(
          presetName.trim(),
          contentType,
          {
            wheelTypeId,
            customItems,
            customPointValues,
          }
        );
      }

      if (preset) {
        setPresetName('');
        setError(null);
        onOpenChange(false);
        onSaveSuccess?.(preset);
      }
    } catch (err) {
      setError('Failed to save preset');
      console.error(err);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPresetName('');
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {saveMode === 'update' ? 'Update Preset' : 'Save Wheel Preset'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="preset-name" className="text-right">
              Name
            </Label>
            <Input
              id="preset-name"
              placeholder="e.g., Quiz Night Setup"
              value={presetName}
              onChange={(e) => {
                setPresetName(e.target.value);
                setError(null);
              }}
              className="col-span-3"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-[#27ae60] hover:bg-[#229954]">
            {saveMode === 'update' ? 'Update' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
