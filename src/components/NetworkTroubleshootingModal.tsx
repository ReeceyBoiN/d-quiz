import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { AlertTriangle, Wifi, WifiOff, Copy, CheckCircle } from "lucide-react";

interface NetworkTroubleshootingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wsConnected: boolean;
  networkAvailable: boolean;
}

export function NetworkTroubleshootingModal({
  open,
  onOpenChange,
  wsConnected,
  networkAvailable
}: NetworkTroubleshootingModalProps) {
  const [hostInfo, setHostInfo] = useState<{ hostIP?: string; wsUrl?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch host info when modal opens
  useEffect(() => {
    if (open && !hostInfo) {
      setLoading(true);
      const fetchHostInfo = async () => {
        try {
          // Try to get host info from IPC or API
          if (window.api?.backend?.getHostInfo) {
            const info = await window.api.backend.getHostInfo();
            setHostInfo(info);
          } else {
            // Fallback: try to fetch from API
            const response = await fetch('/api/host-info');
            if (response.ok) {
              const data = await response.json();
              setHostInfo(data);
            }
          }
        } catch (error) {
          console.error('Failed to fetch host info:', error);
          setHostInfo({ hostIP: 'Unable to fetch', wsUrl: 'Check backend connection' });
        } finally {
          setLoading(false);
        }
      };
      
      fetchHostInfo();
    }
  }, [open, hostInfo]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            {networkAvailable ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <AlertDialogTitle>Network Connection Status</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            {networkAvailable
              ? "Your host is connected to the network and ready for players."
              : "Your host is not connected to a local network. Players will not be able to connect."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Section */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              {networkAvailable ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Connected
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Not Connected
                </>
              )}
            </h3>
            <p className="text-sm text-slate-600 space-y-1">
              <div>
                Network Available: <span className={networkAvailable ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                  {networkAvailable ? "Yes" : "No"}
                </span>
              </div>
              <div>
                WebSocket Status: <span className={wsConnected ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                  {wsConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </p>
          </div>

          {/* Host Information Section */}
          {hostInfo && (
            <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
              <h3 className="font-semibold">Host Information</h3>
              
              {hostInfo.hostIP && (
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Host IP Address</label>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-white border border-slate-300 rounded px-2 py-1 flex-1 font-mono">
                      {hostInfo.hostIP}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(hostInfo.hostIP || '', 'ip')}
                      className="h-8 w-8 p-0"
                    >
                      {copiedField === 'ip' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {hostInfo.wsUrl && (
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">WebSocket URL</label>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-white border border-slate-300 rounded px-2 py-1 flex-1 font-mono truncate">
                      {hostInfo.wsUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(hostInfo.wsUrl || '', 'ws')}
                      className="h-8 w-8 p-0"
                    >
                      {copiedField === 'ws' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Troubleshooting Steps */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <h3 className="font-semibold mb-3">Troubleshooting Steps</h3>
            <ol className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2">
                <span className="font-semibold text-slate-600 min-w-fit">1.</span>
                <span>Ensure all players are connected to the same WiFi network as the host</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-slate-600 min-w-fit">2.</span>
                <span>Share the Host IP address with players - they need this to connect</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-slate-600 min-w-fit">3.</span>
                <span>Check that your router and firewall aren't blocking port 4310</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-slate-600 min-w-fit">4.</span>
                <span>Try refreshing the player app and reconnecting</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-slate-600 min-w-fit">5.</span>
                <span>Restart the host application if issues persist</span>
              </li>
            </ol>
          </div>

          {/* Debug Info */}
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold text-slate-600 mb-2">Debug Information</summary>
            <div className="bg-white border border-slate-300 rounded p-2 font-mono space-y-1">
              <div>Browser Online: {navigator.onLine ? "Yes" : "No"}</div>
              <div>Network Available: {networkAvailable ? "Yes" : "No"}</div>
              <div>WebSocket Connected: {wsConnected ? "Yes" : "No"}</div>
              {hostInfo?.hostIP && <div>Host IP: {hostInfo.hostIP}</div>}
            </div>
          </details>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
