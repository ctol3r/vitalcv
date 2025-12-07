'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { VerifierHeader } from '@/components/verification/VerifierHeader';
import { SdResultPanel } from '@/components/verification/SdResultPanel';
import { ZKChainPanel } from '@/components/verification/ZKChainPanel';
import { Loader2 } from 'lucide-react';

// Mock type for result
interface VerificationResult {
  valid: boolean;
  zkValid?: boolean;
  sdValid?: boolean;
  disclosedFields: Record<string, any>;
  chainAnchor?: {
    txId: string;
    txHash: string;
    blockNumber: number;
    proofHash: string;
    explorerUrl?: string;
  };
}

export default function VerifyPage() {
  const [step, setStep] = useState<'select' | 'request' | 'result'>('select');
  const [credentialType, setCredentialType] = useState('MedicalCredential');
  const [proofType, setProofType] = useState<'sd' | 'zk'>('sd');
  const [requestUrl, setRequestUrl] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateRequest = () => {
    // In a real app, we would call the backend to generate a presentation request
    // For now, we mock the request URL
    const url = `openid-vc://request?type=${credentialType}&proof=${proofType}&nonce=${Date.now()}`;
    setRequestUrl(url);
    setStep('request');
    setIsLoading(true);

    // Simulate polling/receiving response
    // In reality, we would poll an endpoint or use a websocket/SSE
    setTimeout(() => {
       // Mock response
       setResult({
         valid: true,
         zkValid: proofType === 'zk',
         sdValid: true,
         disclosedFields: {
             name: 'Dr. Ava Coleman',
             license: 'MD12345678',
             specialty: 'Emergency Medicine'
         },
         chainAnchor: {
             txId: '0x71c9547832876a78...', // For SdResultPanel
             txHash: '0x71c9547832876a78...', // For ZKChainPanel
             blockNumber: 12405,
             proofHash: '0x99887766554433221100aabbccddeeff...',
             explorerUrl: 'https://explorer.vital.id/tx/0x71c9...'
         }
       });
       setIsLoading(false);
       setStep('result');
    }, 4000);
  };

  const handleReset = () => {
      setStep('select');
      setResult(null);
      setRequestUrl('');
  };

  return (
     <div className="container mx-auto max-w-4xl py-8 px-4">
       <VerifierHeader
         title="Verify Credential"
         description="Request and verify credentials using SD-JWT or Zero-Knowledge Proofs."
         proofType={step === 'result' ? proofType : undefined}
       />

       {step === 'select' && (
         <Card>
           <CardHeader>
             <CardTitle>Request Verification</CardTitle>
             <CardDescription>Choose the credential type and proof method.</CardDescription>
           </CardHeader>
           <CardContent className="space-y-6">
             <div className="space-y-2">
               <Label>Credential Type</Label>
               <Select value={credentialType} onValueChange={setCredentialType}>
                 <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="MedicalCredential">Medical Credential</SelectItem>
                   <SelectItem value="BoardCertification">Board Certification</SelectItem>
                   <SelectItem value="DEALicense">DEA License</SelectItem>
                 </SelectContent>
               </Select>
             </div>

             <div className="space-y-2">
               <Label>Proof Type</Label>
               <RadioGroup value={proofType} onValueChange={(v: any) => setProofType(v)} className="flex flex-col space-y-2">
                 <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer transition-colors ${proofType === 'sd' ? 'bg-accent border-primary' : 'hover:bg-accent'}`}>
                   <RadioGroupItem value="sd" id="sd" />
                   <Label htmlFor="sd" className="flex-1 cursor-pointer">
                     <div className="font-medium">Selective Disclosure (SD-JWT)</div>
                     <div className="text-xs text-muted-foreground">Reveal specific fields with cryptographic signatures.</div>
                   </Label>
                 </div>
                 <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer transition-colors ${proofType === 'zk' ? 'bg-indigo-50 border-indigo-500' : 'hover:bg-accent'}`}>
                   <RadioGroupItem value="zk" id="zk" />
                   <Label htmlFor="zk" className="flex-1 cursor-pointer">
                     <div className="font-medium">Zero-Knowledge Proof (ZK)</div>
                     <div className="text-xs text-muted-foreground">Prove properties (e.g. "License is valid") without revealing data.</div>
                   </Label>
                 </div>
               </RadioGroup>
             </div>

             <Button onClick={handleGenerateRequest} className="w-full">Generate Request QR</Button>
           </CardContent>
         </Card>
       )}

       {step === 'request' && (
         <Card>
           <CardHeader>
             <CardTitle>Scan Request</CardTitle>
             <CardDescription>Scan this QR code with your wallet app.</CardDescription>
           </CardHeader>
           <CardContent className="flex flex-col items-center space-y-6 pt-4">
             <div className="p-4 bg-white rounded-lg border shadow-sm">
                <QRCodeDisplay data={requestUrl} size={256} />
             </div>

             {isLoading && (
                 <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                     <Loader2 className="h-4 w-4 animate-spin" />
                     Waiting for wallet response...
                 </div>
             )}

             <div className="w-full pt-4 border-t">
                <p className="text-xs text-muted-foreground font-mono break-all mb-4 bg-slate-50 p-2 rounded text-center">{requestUrl}</p>
                <Button variant="ghost" onClick={handleReset} className="w-full">Cancel</Button>
             </div>
           </CardContent>
         </Card>
       )}

       {step === 'result' && result && (
         <div className="space-y-6">
            {proofType === 'sd' && (
                <SdResultPanel
                    disclosedFields={result.disclosedFields}
                    chainAnchor={result.chainAnchor}
                    timestamp={new Date().toISOString()}
                />
            )}

            {proofType === 'zk' && (
                <div className="grid gap-6">
                    <Card className="border-green-500 border-l-4">
                        <CardHeader>
                            <CardTitle>Proof Valid</CardTitle>
                            <CardDescription>Zero-Knowledge proof verified successfully.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">The credential holder has proven they meet the requirements without revealing the underlying data.</p>
                        </CardContent>
                    </Card>
                    <ZKChainPanel chainAnchor={result.chainAnchor} />
                </div>
            )}

            <div className="flex justify-end">
                <Button onClick={handleReset}>Verify Another</Button>
            </div>
         </div>
       )}
     </div>
  );
}
