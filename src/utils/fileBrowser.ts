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

export async function readFileAsBlob(filePath: string): Promise<File | null> {
  const w = getWindow();

  // ✅ Electron environment
  if (w?.api?.files?.readFileAsBlob) {
    const res = await w.api.files.readFileAsBlob(filePath);
    if (!res?.ok) throw new Error(res?.error || "Failed to read file");
    const blob = new Blob([res.data.buffer]);
    const name = filePath.split(/[\\/]/).pop() || "quiz.sqq";
    return new File([blob], name, { type: "application/octet-stream" });
  }

  // ✅ Browser fallback using the virtual FS
  if (filePath.startsWith("vfs:")) {
    // Access the internal map safely
    const handle = (vfsMap as Map<string, any>).get(filePath);
    if (handle && typeof handle.getFile === "function") {
      return await handle.getFile();
    }
    console.warn("File handle not found for", filePath);
  }

  return null;
}


async function ensureVfsRoot(): Promise<string> {
  const w = getWindow();
  if (!w) throw new Error('No window');
  if (vfsRoot) return `${VFS_PREFIX}/${vfsRoot.name}`;
  if (typeof (w as any).showDirectoryPicker !== 'function') {
    return `${VFS_PREFIX}/`;
  }
  try {
    // Some environments (e.g., cross-origin iframes) disallow file pickers
    vfsRoot = await (w as any).showDirectoryPicker();
    const rootPath = `${VFS_PREFIX}/${vfsRoot.name}`;
    vfsMap.set(rootPath, vfsRoot);
    return rootPath;
  } catch (err) {
    // Graceful fallback: no picker available, use empty virtual root
    return `${VFS_PREFIX}/`;
  }
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

export function getParentPath(inputPath: string): string | null {
  if (!inputPath) return null;
  // VFS paths: keep within vfs:/<rootName>
  if (inputPath.startsWith(`${VFS_PREFIX}/`)) {
    const normalized = inputPath.replace(/\\/g, '/');
    const rootParts = normalized.split('/').slice(0, 2); // ["vfs:", "<root>"]
    const root = rootParts.join('/');
    const trimmed = normalized.endsWith('/') && normalized.length > root.length ? normalized.slice(0, -1) : normalized;
    const lastSlash = trimmed.lastIndexOf('/');
    if (lastSlash <= root.length) return null; // at root, no parent above
    return trimmed.slice(0, lastSlash);
  }

  // Generic (Electron/OS) paths: support both Windows and POSIX
  const normalized = inputPath.replace(/\\/g, '/');
  // Detect Windows drive root like C:/
  const m = normalized.match(/^([a-zA-Z]):\//);
  const driveRoot = m ? `${m[1]}:/` : '/';

  // Remove trailing slash except for root
  const trimmed = normalized !== driveRoot && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;

  // If already at root, no parent
  if (trimmed === driveRoot || trimmed === '/' || /^[a-zA-Z]:$/.test(trimmed)) {
    return null;
  }

  const lastSlash = trimmed.lastIndexOf('/');
  if (lastSlash <= (m ? driveRoot.length - 1 : 0)) {
    // No higher parent beyond root
    return m ? driveRoot : '/';
  }
  const parent = trimmed.slice(0, lastSlash);
  // Convert back to backslashes for Windows aesthetics if original used them
  if (/^[a-zA-Z]:[\\]/.test(inputPath)) {
    return parent.replace(/\//g, '\\');
  }
  return parent;
}
