import React, { useState, useRef } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Plus, Minus, Download, Upload, Trash2, Edit2 } from 'lucide-react';
import { wheelTypeStorage, WheelTypeDefinition, WheelTypeItem } from '../../utils/wheelTypeStorage';

interface WheelTypeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTypeCreated?: (type: WheelTypeDefinition) => void;
  onTypeDeleted?: (typeId: string) => void;
}

type ManagerTab = 'list' | 'create' | 'edit';

export function WheelTypeManager({
  open,
  onOpenChange,
  onTypeCreated,
  onTypeDeleted,
}: WheelTypeManagerProps) {
  const [tab, setTab] = useState<ManagerTab>('list');
  const [wheelTypes, setWheelTypes] = useState<WheelTypeDefinition[]>([]);
  const [editingType, setEditingType] = useState<WheelTypeDefinition | null>(null);
  
  // Form state for create/edit
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [typeItems, setTypeItems] = useState<WheelTypeItem[]>([
    { id: '1', label: 'Item 1' },
    { id: '2', label: 'Item 2' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load types when dialog opens
  React.useEffect(() => {
    if (open) {
      const types = wheelTypeStorage.loadAll();
      setWheelTypes(types);
      setTab('list');
      setError(null);
    }
  }, [open]);

  const resetForm = () => {
    setTypeName('');
    setTypeDescription('');
    setTypeItems([
      { id: '1', label: 'Item 1' },
      { id: '2', label: 'Item 2' },
    ]);
    setEditingType(null);
    setError(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setTab('create');
  };

  const handleStartEdit = (type: WheelTypeDefinition) => {
    setEditingType(type);
    setTypeName(type.name);
    setTypeDescription(type.description || '');
    setTypeItems([...type.items]);
    setTab('edit');
    setError(null);
  };

  const handleSaveType = () => {
    if (!typeName.trim()) {
      setError('Type name is required');
      return;
    }

    if (typeItems.length < 2) {
      setError('At least 2 items are required');
      return;
    }

    if (typeItems.some(item => !item.label.trim())) {
      setError('All items must have labels');
      return;
    }

    try {
      if (editingType) {
        const updated = wheelTypeStorage.update(editingType.id, {
          name: typeName.trim(),
          description: typeDescription.trim() || undefined,
          items: typeItems,
        });
        if (updated) {
          const types = wheelTypeStorage.loadAll();
          setWheelTypes(types);
          setTab('list');
          resetForm();
        }
      } else {
        const newType = wheelTypeStorage.create(
          typeName.trim(),
          typeItems,
          typeDescription.trim() || undefined
        );
        const types = wheelTypeStorage.loadAll();
        setWheelTypes(types);
        onTypeCreated?.(newType);
        setTab('list');
        resetForm();
      }
    } catch (err) {
      setError('Failed to save type');
      console.error(err);
    }
  };

  const handleDeleteType = (typeId: string) => {
    if (confirm('Are you sure you want to delete this wheel type?')) {
      if (wheelTypeStorage.delete(typeId)) {
        const types = wheelTypeStorage.loadAll();
        setWheelTypes(types);
        onTypeDeleted?.(typeId);
      }
    }
  };

  const handleExportType = (typeId: string) => {
    wheelTypeStorage.downloadAsFile(typeId);
  };

  const handleImportType = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imported = await wheelTypeStorage.importFromFile(file);
    if (imported) {
      const types = wheelTypeStorage.loadAll();
      setWheelTypes(types);
      onTypeCreated?.(imported);
      setError(null);
    } else {
      setError('Failed to import wheel type');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addItem = () => {
    const newId = `item-${Date.now()}`;
    setTypeItems([
      ...typeItems,
      { id: newId, label: `Item ${typeItems.length + 1}` },
    ]);
  };

  const removeItem = (index: number) => {
    if (typeItems.length > 2) {
      setTypeItems(typeItems.filter((_, i) => i !== index));
    }
  };

  const updateItemLabel = (index: number, label: string) => {
    const updated = [...typeItems];
    updated[index] = { ...updated[index], label };
    setTypeItems(updated);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Wheel Types</DialogTitle>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setTab('list')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'list'
                ? 'border-blue-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Wheel Types ({wheelTypes.length})
          </button>
          <button
            onClick={handleStartCreate}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'create'
                ? 'border-blue-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Create New
          </button>
        </div>

        {/* Content */}
        <div className="py-4">
          {tab === 'list' && (
            <div className="space-y-3">
              {wheelTypes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No custom wheel types yet. Create one to get started!
                </p>
              ) : (
                wheelTypes.map((type) => (
                  <Card key={type.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{type.name}</h3>
                          {type.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {type.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {type.items.length} items • Created{' '}
                            {new Date(type.createdAt).toLocaleDateString()}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {type.items.slice(0, 3).map((item) => (
                              <span
                                key={item.id}
                                className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded"
                              >
                                {item.label}
                              </span>
                            ))}
                            {type.items.length > 3 && (
                              <span className="text-xs text-muted-foreground px-2 py-1">
                                +{type.items.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartEdit(type)}
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportType(type.id)}
                            title="Export"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteType(type.id)}
                            title="Delete"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              <div className="pt-4 border-t">
                <Button
                  onClick={handleImportType}
                  variant="outline"
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Wheel Type
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".wtype.json,application/json"
                  onChange={handleFileSelected}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {(tab === 'create' || tab === 'edit') && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="type-name">Type Name *</Label>
                <Input
                  id="type-name"
                  placeholder="e.g., Difficulty Levels"
                  value={typeName}
                  onChange={(e) => {
                    setTypeName(e.target.value);
                    setError(null);
                  }}
                  className="mt-1"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="type-desc">Description</Label>
                <Input
                  id="type-desc"
                  placeholder="Optional description"
                  value={typeDescription}
                  onChange={(e) => setTypeDescription(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Items *</Label>
                  <Button
                    onClick={addItem}
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {typeItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateItemLabel(index, e.target.value)}
                        placeholder="Item label"
                        className="h-8 flex-1"
                      />
                      <Button
                        onClick={() => removeItem(index)}
                        disabled={typeItems.length <= 2}
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-8 w-8 p-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(tab === 'create' || tab === 'edit') && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setTab('list')}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveType}
              className="bg-[#27ae60] hover:bg-[#229954]"
            >
              {editingType ? 'Update Type' : 'Create Type'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
