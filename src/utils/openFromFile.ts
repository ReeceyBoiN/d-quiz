export interface OpenFromFileResult {
  ok: boolean;
  data?: any;
  error?: string;
}

export async function openFromFile(): Promise<OpenFromFileResult> {
  try {
    const w = typeof window !== 'undefined' ? (window as any) : undefined;

    // Prefer Electron if available
    if (w?.api?.files?.openFromFile) {
      const res = await w.api.files.openFromFile();
      return res ?? { ok: false, error: 'Unknown response from Electron API' };
    }

    // Browser fallback: prompt user to pick a folder or files
    const files = await pickFilesOrDirectory();
    return { ok: true, data: { files } };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function pickFilesOrDirectory(): Promise<File[]> {
  return new Promise((resolve, reject) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      // Try directory selection when supported
      try { (input as any).webkitdirectory = true; } catch {}
      input.style.position = 'fixed';
      input.style.left = '-9999px';

      const cleanup = () => {
        input.removeEventListener('change', onChange);
        if (input.parentNode) input.parentNode.removeChild(input);
      };

      const onChange = () => {
        const list = Array.from(input.files || []);
        cleanup();
        resolve(list);
      };

      input.addEventListener('change', onChange, { once: true });
      document.body.appendChild(input);
      input.click();
    } catch (err) {
      reject(err);
    }
  });
}
