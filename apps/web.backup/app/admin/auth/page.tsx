"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Key,
  Plus,
  Trash2,
  Shield,
  Smartphone,
  Usb,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Edit,
  Copy,
  Download,
} from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || "http://localhost:4003";

interface Authenticator {
  id: string;
  name: string;
  deviceBound: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

interface AalStatus {
  userId: string;
  currentAal: number;
  requiredAal: number;
  meetsRequirement: boolean;
  authenticators: {
    id: string;
    type: string;
    deviceBound: boolean;
    phishingResistant: boolean;
  }[];
}

interface RecoveryKey {
  id: string;
  name: string | null;
  usedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export default function WebAuthnEnrollment() {
  const [authenticators, setAuthenticators] = useState<Authenticator[]>([]);
  const [aalStatus, setAalStatus] = useState<AalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newAuthenticatorName, setNewAuthenticatorName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [recoveryKeys, setRecoveryKeys] = useState<RecoveryKey[]>([]);
  const [isRecoveryKeysOpen, setIsRecoveryKeysOpen] = useState(false);
  const [newRecoveryKeyName, setNewRecoveryKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Get current user ID (in production, get from auth context)
  const userId = "current-user-id"; // TODO: Replace with actual user ID

  useEffect(() => {
    fetchAuthenticators();
    fetchAalStatus();
    fetchRecoveryKeys();
  }, []);

  const fetchAuthenticators = async () => {
    try {
      const response = await fetch(`${ADMIN_API_URL}/api/auth/webauthn/authenticators?userId=${userId}`);
      if (!response.ok) throw new Error("Failed to fetch authenticators");
      const data = await response.json();
      setAuthenticators(data.authenticators || []);
    } catch (err: any) {
      console.error("Failed to fetch authenticators:", err);
      setError(err.message || "Failed to load authenticators");
    } finally {
      setLoading(false);
    }
  };

  const fetchAalStatus = async () => {
    try {
      const response = await fetch(`${ADMIN_API_URL}/api/auth/policy/user/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch AAL status");
      const data = await response.json();
      setAalStatus(data.status);
    } catch (err: any) {
      console.error("Failed to fetch AAL status:", err);
    }
  };

  const fetchRecoveryKeys = async () => {
    try {
      const response = await fetch(`${ADMIN_API_URL}/api/auth/recovery-keys?userId=${userId}`);
      if (!response.ok) throw new Error("Failed to fetch recovery keys");
      const data = await response.json();
      setRecoveryKeys(data.recoveryKeys || []);
    } catch (err: any) {
      console.error("Failed to fetch recovery keys:", err);
    }
  };

  const handleEnroll = async () => {
    if (!newAuthenticatorName.trim()) {
      setError("Please enter a name for this authenticator");
      return;
    }

    setEnrolling(true);
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Start registration
      const startResponse = await fetch(`${ADMIN_API_URL}/api/auth/webauthn/register/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          requireDeviceBound: aalStatus?.requiredAal === 3,
        }),
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(errorData.error || "Failed to start registration");
      }

      const { options, challengeId } = await startResponse.json();

      // Step 2: Call WebAuthn API
      let attestationResponse;
      try {
        attestationResponse = await startRegistration(options);
      } catch (webauthnError: any) {
        throw new Error(
          webauthnError.message || "WebAuthn registration failed. Please try again."
        );
      }

      // Step 3: Finish registration
      const finishResponse = await fetch(`${ADMIN_API_URL}/api/auth/webauthn/register/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          response: attestationResponse,
          challengeId,
          name: newAuthenticatorName.trim(),
        }),
      });

      if (!finishResponse.ok) {
        const errorData = await finishResponse.json();
        throw new Error(errorData.error || "Failed to complete registration");
      }

      setSuccess(`Authenticator "${newAuthenticatorName}" enrolled successfully`);
      setNewAuthenticatorName("");
      setIsDialogOpen(false);
      await fetchAuthenticators();
      await fetchAalStatus();
    } catch (err: any) {
      console.error("Enrollment error:", err);
      setError(err.message || "Failed to enroll authenticator");
    } finally {
      setEnrolling(false);
    }
  };

  const handleRevoke = async (authenticatorId: string, name: string) => {
    try {
      const response = await fetch(
        `${ADMIN_API_URL}/api/auth/webauthn/authenticators/${authenticatorId}?userId=${userId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to revoke authenticator");
      }

      setSuccess(`Authenticator "${name}" revoked successfully`);
      await fetchAuthenticators();
      await fetchAalStatus();
    } catch (err: any) {
      console.error("Revoke error:", err);
      setError(err.message || "Failed to revoke authenticator");
    }
  };

  const handleRename = async (authenticatorId: string, currentName: string) => {
    if (!renameValue.trim()) {
      setError("Please enter a name");
      return;
    }

    try {
      const response = await fetch(
        `${ADMIN_API_URL}/api/auth/webauthn/authenticators/${authenticatorId}/rename`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            name: renameValue.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to rename authenticator");
      }

      setSuccess(`Authenticator renamed to "${renameValue.trim()}"`);
      setRenamingId(null);
      setRenameValue("");
      await fetchAuthenticators();
    } catch (err: any) {
      console.error("Rename error:", err);
      setError(err.message || "Failed to rename authenticator");
    }
  };

  const handleGenerateRecoveryKey = async () => {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${ADMIN_API_URL}/api/auth/recovery-keys/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name: newRecoveryKeyName.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate recovery key");
      }

      const data = await response.json();
      setGeneratedKey(data.key);
      setNewRecoveryKeyName("");
      await fetchRecoveryKeys();
    } catch (err: any) {
      console.error("Generate recovery key error:", err);
      setError(err.message || "Failed to generate recovery key");
    }
  };

  const handleRevokeRecoveryKey = async (recoveryKeyId: string) => {
    try {
      const response = await fetch(
        `${ADMIN_API_URL}/api/auth/recovery-keys/${recoveryKeyId}?userId=${userId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to revoke recovery key");
      }

      setSuccess("Recovery key revoked successfully");
      await fetchRecoveryKeys();
    } catch (err: any) {
      console.error("Revoke recovery key error:", err);
      setError(err.message || "Failed to revoke recovery key");
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setSuccess("Recovery key copied to clipboard");
    } catch (err) {
      setError("Failed to copy recovery key");
    }
  };

  const handleDownloadKey = (key: string, name: string | null) => {
    const blob = new Blob([key], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recovery-key-${name || "unnamed"}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess("Recovery key downloaded");
  };

  const getTransportIcon = (transports: string[]) => {
    if (transports.includes("usb")) return <Usb className="h-4 w-4" />;
    if (transports.includes("nfc")) return <Smartphone className="h-4 w-4" />;
    if (transports.includes("ble")) return <Smartphone className="h-4 w-4" />;
    if (transports.includes("internal") || transports.includes("hybrid"))
      return <Smartphone className="h-4 w-4" />;
    return <Key className="h-4 w-4" />;
  };

  const getAalBadge = (aal: number) => {
    const colors = {
      1: "bg-gray-100 text-gray-800",
      2: "bg-blue-100 text-blue-800",
      3: "bg-purple-100 text-purple-800",
    };
    return (
      <Badge className={colors[aal as keyof typeof colors] || colors[1]}>
        AAL{aal}
      </Badge>
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Shield className="h-8 w-8" />
          WebAuthn Authenticator Management
        </h1>
        <p className="text-muted-foreground">
          Enroll, manage, and revoke phishing-resistant authenticators (passkeys, security keys)
        </p>
      </div>

      {/* AAL Status Card */}
      {aalStatus && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Authentication Assurance Level (AAL) Status</CardTitle>
            <CardDescription>
              Current authentication level and compliance status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Current AAL:</span>
                  {getAalBadge(aalStatus.currentAal)}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Required AAL:</span>
                  {getAalBadge(aalStatus.requiredAal)}
                </div>
              </div>
              <div>
                {aalStatus.meetsRequirement ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Compliant</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Not Compliant</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Authenticators List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Authenticators</CardTitle>
              <CardDescription>
                Manage your WebAuthn authenticators (passkeys, security keys)
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Enroll New Authenticator
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enroll New Authenticator</DialogTitle>
                  <DialogDescription>
                    Add a new passkey or security key for phishing-resistant authentication.
                    {aalStatus?.requiredAal === 3 && (
                      <span className="block mt-2 text-amber-600">
                        AAL3 requires a device-bound authenticator (platform authenticator).
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="authenticator-name" className="block text-sm font-medium mb-2">
                      Authenticator Name
                    </label>
                    <Input
                      id="authenticator-name"
                      placeholder="e.g., iPhone 14 Pro, YubiKey 5"
                      value={newAuthenticatorName}
                      onChange={(e) => setNewAuthenticatorName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !enrolling) {
                          handleEnroll();
                        }
                      }}
                      aria-describedby="authenticator-name-help"
                    />
                    <p id="authenticator-name-help" className="text-xs text-muted-foreground mt-1">
                      Give this authenticator a memorable name to identify it later.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        setNewAuthenticatorName("");
                        setError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleEnroll} disabled={enrolling || !newAuthenticatorName.trim()}>
                      {enrolling ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enrolling...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Enroll
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading authenticators...
            </div>
          ) : authenticators.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No authenticators enrolled</p>
              <p className="text-sm">Click "Enroll New Authenticator" to add your first passkey or security key.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {authenticators.map((auth) => (
                <div
                  key={auth.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      {getTransportIcon(auth.transports)}
                      <div>
                        <div className="font-medium">{auth.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-4">
                          <span>
                            Added {new Date(auth.createdAt).toLocaleDateString()}
                          </span>
                          {auth.lastUsedAt && (
                            <span>
                              Last used {new Date(auth.lastUsedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {auth.deviceBound && (
                        <Badge variant="secondary" className="text-xs" aria-label="Device-bound authenticator">
                          Device-bound
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs" aria-label="Phishing-resistant authenticator">
                        Phishing-resistant
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {renamingId === auth.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleRename(auth.id, auth.name);
                            } else if (e.key === "Escape") {
                              setRenamingId(null);
                              setRenameValue("");
                            }
                          }}
                          className="w-32"
                          aria-label={`Rename ${auth.name}`}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => handleRename(auth.id, auth.name)}
                          aria-label="Save rename"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRenamingId(null);
                            setRenameValue("");
                          }}
                          aria-label="Cancel rename"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRenamingId(auth.id);
                            setRenameValue(auth.name);
                          }}
                          aria-label={`Rename ${auth.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label={`Revoke ${auth.name}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke Authenticator</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to revoke "{auth.name}"? You will no longer be able to use this
                                authenticator for authentication. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRevoke(auth.id, auth.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Revoke
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recovery Keys Section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recovery Keys</CardTitle>
              <CardDescription>
                Generate backup recovery keys to regain access if you lose your authenticators
              </CardDescription>
            </div>
            <Dialog open={isRecoveryKeysOpen} onOpenChange={setIsRecoveryKeysOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Key className="h-4 w-4 mr-2" />
                  Generate Recovery Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Recovery Key</DialogTitle>
                  <DialogDescription>
                    Recovery keys allow you to regain access to your account if you lose all your authenticators.
                    Save this key securely - it will only be shown once.
                  </DialogDescription>
                </DialogHeader>
                {generatedKey ? (
                  <div className="space-y-4">
                    <Alert className="border-amber-200 bg-amber-50">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800">
                        <strong>Important:</strong> Save this recovery key now. It will not be shown again.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Recovery Key</label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={generatedKey}
                          readOnly
                          className="font-mono text-sm"
                          aria-label="Generated recovery key"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyKey(generatedKey)}
                          aria-label="Copy recovery key"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadKey(generatedKey, newRecoveryKeyName)}
                          aria-label="Download recovery key"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => {
                          setGeneratedKey(null);
                          setIsRecoveryKeysOpen(false);
                        }}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="recovery-key-name" className="block text-sm font-medium mb-2">
                        Key Name (Optional)
                      </label>
                      <Input
                        id="recovery-key-name"
                        placeholder="e.g., Backup Key 1"
                        value={newRecoveryKeyName}
                        onChange={(e) => setNewRecoveryKeyName(e.target.value)}
                        aria-describedby="recovery-key-name-help"
                      />
                      <p id="recovery-key-name-help" className="text-xs text-muted-foreground mt-1">
                        Give this recovery key a name to identify it later.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsRecoveryKeysOpen(false);
                          setNewRecoveryKeyName("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleGenerateRecoveryKey}>
                        <Key className="h-4 w-4 mr-2" />
                        Generate Key
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {recoveryKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No recovery keys generated</p>
              <p className="text-sm">Generate a recovery key as a backup authentication method.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recoveryKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  role="listitem"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <Key className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <div className="font-medium">{key.name || "Unnamed Recovery Key"}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-4">
                        <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                        {key.usedAt && (
                          <span className="text-amber-600">Used {new Date(key.usedAt).toLocaleDateString()}</span>
                        )}
                        {key.revokedAt && (
                          <span className="text-destructive">Revoked {new Date(key.revokedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {key.usedAt && (
                      <Badge variant="secondary" className="text-xs">
                        Used
                      </Badge>
                    )}
                    {key.revokedAt && (
                      <Badge variant="destructive" className="text-xs">
                        Revoked
                      </Badge>
                    )}
                    {!key.revokedAt && !key.usedAt && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label={`Revoke recovery key ${key.name || key.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke Recovery Key</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to revoke this recovery key? You will no longer be able to use it
                              for authentication. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevokeRecoveryKey(key.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>About WebAuthn Authenticators</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">What are WebAuthn authenticators?</h3>
            <p className="text-sm text-muted-foreground">
              WebAuthn authenticators provide phishing-resistant multi-factor authentication. They can be:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>
                <strong>Platform authenticators</strong> (device-bound): Built into your device (e.g., Touch ID, Face ID,
                Windows Hello)
              </li>
              <li>
                <strong>Cross-platform authenticators</strong>: External security keys (e.g., YubiKey, Titan Security Key)
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">AAL Requirements</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>
                <strong>AAL2</strong>: Requires multi-factor authenticator (WebAuthn or TOTP)
              </li>
              <li>
                <strong>AAL3</strong>: Requires device-bound cryptographic authenticator (platform authenticator)
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

