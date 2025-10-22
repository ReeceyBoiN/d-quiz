export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

function getWindow(): any | undefined {
  return typeof window !== 'undefined' ? (window as any) : undefined;
}

// Simple in-memory virtual FS mapping for browser fallback
const VFS_PREFIX = 'vfs:';
let vfsRoot: any | null = null; // FileSystemDirectoryHandle
const vfsMap = new Map<string, any>(); // path -> handle

async function ensureVfsRoot(): Promise<string> {
  const w = getWindow();
  if (!w) throw new Error('No window');
  if (vfsRoot) return `${VFS_PREFIX}/${vfsRoot.name}`;
  if (typeof (w as any).showDirectoryPicker !== 'function') {
    // Browser cannot pick directories; return empty root
    return `${VFS_PREFIX}/`;
  }
  vfsRoot = await (w as any).showDirectoryPicker();
  const rootPath = `${VFS_PREFIX}/${vfsRoot.name}`;
  vfsMap.set(rootPath, vfsRoot);
  return rootPath;
}

export async function getQuestionPacksPath(): Promise<string> {
  const w = getWindow();
  // Electron path
  if (w?.api?.files?.questionPacksPath) {
    const res = await w.api.files.questionPacksPath();
    if (!res?.ok) throw new Error(res?.error || 'Failed to resolve Question Packs path');
    return res.data.path as string;
  }
  // Browser fallback – ask user to pick a folder and use it as root
  return await ensureVfsRoot();
}

export async function listDirectory(dirPath: string): Promise<FileEntry[]> {
  const w = getWindow();
  // Electron path
  if (w?.api?.files?.listDirectory) {
    const res = await w.api.files.listDirectory(dirPath);
    if (!res?.ok) throw new Error(res?.error || 'Failed to list directory');
    return (res.data.entries as FileEntry[]) || [];
  }

  // Browser fallback using File System Access API
  if (!dirPath.startsWith(VFS_PREFIX)) {
    // Unknown path in browser mode
    return [];
  }
  if (!vfsRoot) {
    await ensureVfsRoot();
  }
  const handle = vfsMap.get(dirPath) || vfsRoot;
  if (!handle) return [];

  const entries: FileEntry[] = [];
  if (handle && typeof handle.entries === 'function') {
    // DirectoryHandle.entries() is async iterable
    for await (const [name, childHandle] of handle.entries() as any) {
      const childPath = `${dirPath}/${name}`;
      if (childHandle && childHandle.kind === 'directory') {
        vfsMap.set(childPath, childHandle);
      }
      entries.push({
        name,
        path: childPath,
        isDirectory: childHandle?.kind === 'directory',
      });
    }
  }
  // Sort directories first, then files, alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}
