import React, { useState } from 'react';

export default function OpenFromFileButton({ className }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    try {
      setLoading(true);
      const res = await window.api?.files?.openFromFile();
      if (!res || res.ok === false) {
        // Prefer console error over UI alert to avoid styling changes
        console.error(res?.error || 'Failed to open folder');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={handleClick} className={className || 'btn-open-from-file'} disabled={loading}>
      {loading ? 'Opening…' : 'Open From File'}
    </button>
  );
}
