'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtime } from "@/hooks/useRealtime";
import { useEffect, useState } from "react";
import { ShieldCheck, FileText } from "lucide-react";

interface StreamEvent {
  id: string;
  type: 'verification' | 'credential' | 'audit';
  title: string;
  description: string;
  timestamp: Date;
  data: any;
}

export default function LiveVerificationStream() {
  const { onVerificationUpdate, onCredentialUpdate, isConnected } = useRealtime();
  const [events, setEvents] = useState<StreamEvent[]>([]);

  useEffect(() => {
    const cleanupVerification = onVerificationUpdate((data) => {
        const newEvent: StreamEvent = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'verification',
            title: 'Verification Submitted',
            description: `Verification result: ${data.verified ? 'Success' : 'Failed'}`,
            timestamp: new Date(),
            data
        };
        setEvents(prev => [newEvent, ...prev]);
    });

    const cleanupCredential = onCredentialUpdate((data) => {
        const newEvent: StreamEvent = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'credential',
            title: `Credential ${data.status}`,
            description: `Credential for NPI ${data.npi} was ${data.status}`,
            timestamp: new Date(),
            data
        };
        setEvents(prev => [newEvent, ...prev]);
    });

    return () => {
        cleanupVerification();
        cleanupCredential();
    };
  }, [onVerificationUpdate, onCredentialUpdate]);

  return (
    <div className="container mx-auto p-6 space-y-8">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Live Verification Stream</h1>
                <p className="text-muted-foreground">Real-time view of verification and credential events.</p>
            </div>
             <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground">{isConnected ? 'Live' : 'Connecting...'}</span>
            </div>
        </div>

        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Event Stream</CardTitle>
                    <CardDescription>Incoming events from the network.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-8">
                        {events.length === 0 && <div className="text-center text-muted-foreground py-10">Waiting for events...</div>}
                        {events.map((event) => (
                            <div key={event.id} className="flex items-start gap-4 border-b pb-4 last:border-0">
                                <div className="mt-1 bg-muted p-2 rounded-full">
                                    {event.type === 'verification' && <ShieldCheck className="h-4 w-4 text-blue-500" />}
                                    {event.type === 'credential' && <FileText className="h-4 w-4 text-green-500" />}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">{event.title}</p>
                                    <p className="text-sm text-muted-foreground">{event.description}</p>
                                    <p className="text-xs text-muted-foreground">{event.timestamp.toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}














