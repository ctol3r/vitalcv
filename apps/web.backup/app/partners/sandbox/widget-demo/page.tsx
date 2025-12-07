'use client';

/**
 * B133B-FE-006: 'Try the widget' sandbox page (embedded job + test apply flow)
 *
 * Interactive widget demo for partners to test the "Apply with VitalCV" flow.
 * Features:
 * - Embedded sample job listing
 * - Live widget integration
 * - Shows resulting payload
 * - Clear warnings that data is fake
 * - Step-by-step flow visualization
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle2,
  ArrowRight,
  Copy,
  RefreshCw,
  PlayCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SampleJob {
  id: string;
  title: string;
  organization: string;
  location: string;
  specialty: string;
  type: 'permanent' | 'locum';
  salaryRange: string;
  description: string;
  requirements: string[];
}

const sampleJobs: SampleJob[] = [
  {
    id: 'job_001',
    title: 'SAMPLE - Family Medicine Physician',
    organization: 'SAMPLE - Memorial Hospital',
    location: 'Boston, MA',
    specialty: 'Family Medicine',
    type: 'permanent',
    salaryRange: '$200,000 - $280,000',
    description: 'Sample job posting for a Family Medicine Physician. This is demo data for sandbox testing only.',
    requirements: [
      'Valid medical license in MA',
      'Board certified or board eligible',
      '3+ years experience preferred',
      'DEA license',
    ],
  },
  {
    id: 'job_002',
    title: 'SAMPLE - Emergency Medicine Physician',
    organization: 'SAMPLE - City Medical Center',
    location: 'Chicago, IL',
    specialty: 'Emergency Medicine',
    type: 'locum',
    salaryRange: '$250,000 - $320,000',
    description: 'Sample locum tenens position in Emergency Medicine. This is demo data for sandbox testing only.',
    requirements: [
      'Valid medical license in IL',
      'Board certified in Emergency Medicine',
      '5+ years ER experience',
      'ACLS certification',
    ],
  },
  {
    id: 'job_003',
    title: 'SAMPLE - Psychiatrist',
    organization: 'SAMPLE - Valley Clinic Network',
    location: 'Phoenix, AZ',
    specialty: 'Psychiatry',
    type: 'permanent',
    salaryRange: '$220,000 - $290,000',
    description: 'Sample psychiatric position in outpatient setting. This is demo data for sandbox testing only.',
    requirements: [
      'Valid medical license in AZ',
      'Board certified in Psychiatry',
      '2+ years experience',
      'Experience with telepsychiatry preferred',
    ],
  },
];

export default function WidgetDemoPage() {
  const [selectedJob, setSelectedJob] = useState<SampleJob>(sampleJobs[0]);
  const [widgetToken, setWidgetToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [applicationData, setApplicationData] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<'select' | 'generate' | 'widget' | 'complete'>('select');
  const { toast } = useToast();

  async function generateWidgetToken() {
    setLoadingToken(true);
    try {
      // In a real implementation, this would call your backend
      // For demo purposes, we'll simulate the API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockToken = `wt_sandbox_${Math.random().toString(36).substring(2, 15)}`;
      setWidgetToken(mockToken);
      setCurrentStep('widget');

      toast({
        title: 'Widget token generated',
        description: 'Ready to test the widget',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate widget token',
        variant: 'destructive',
      });
    } finally {
      setLoadingToken(false);
    }
  }

  function handleApplyClick() {
    // Simulate widget interaction
    setCurrentStep('widget');

    // Simulate application submission after a delay
    setTimeout(() => {
      const mockApplication = {
        applicationId: `app_${Math.random().toString(36).substring(2, 15)}`,
        jobId: selectedJob.id,
        clinician: {
          npi: '9123456789',
          firstName: 'SAMPLE-John',
          lastName: 'Doe',
          email: 'sample.john.doe@sandbox.vitalcv.com',
          specialty: selectedJob.specialty,
          licenseState: selectedJob.location.match(/([A-Z]{2})/)![0],
        },
        credentials: {
          verified: true,
          vitalcvId: `vc_${Math.random().toString(36).substring(2, 15)}`,
        },
        submittedAt: new Date().toISOString(),
        status: 'submitted',
      };

      setApplicationData(mockApplication);
      setCurrentStep('complete');

      toast({
        title: '✅ Application submitted!',
        description: 'Check the payload below to see what your system will receive',
      });
    }, 2000);
  }

  function resetDemo() {
    setCurrentStep('select');
    setWidgetToken(null);
    setApplicationData(null);
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  }

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Widget Demo</h1>
        <p className="text-muted-foreground mt-2">
          Test the "Apply with VitalCV" widget with sample job postings
        </p>
      </div>

      {/* Warning Banner */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Demo Environment:</strong> All data shown here is sample/fake data.
          NPIs, names, and credentials are for testing purposes only.
        </AlertDescription>
      </Alert>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {[
          { step: 'select', label: 'Select Job', icon: Briefcase },
          { step: 'generate', label: 'Generate Token', icon: Clock },
          { step: 'widget', label: 'Apply', icon: PlayCircle },
          { step: 'complete', label: 'Review Payload', icon: CheckCircle2 },
        ].map((item, index) => (
          <div key={item.step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentStep === item.step
                    ? 'bg-primary text-primary-foreground'
                    : index < ['select', 'generate', 'widget', 'complete'].indexOf(currentStep)
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-xs mt-2 text-center">{item.label}</span>
            </div>
            {index < 3 && (
              <ArrowRight
                className={`h-4 w-4 mx-2 ${
                  index < ['select', 'generate', 'widget', 'complete'].indexOf(currentStep)
                    ? 'text-green-500'
                    : 'text-muted-foreground'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Job Selection & Widget */}
        <div className="space-y-6">
          {/* Sample Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Sample Job Postings</CardTitle>
              <CardDescription>
                Select a sample job to test the widget
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sampleJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedJob.id === job.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{job.title}</h3>
                      <p className="text-sm text-muted-foreground">{job.organization}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {job.location}
                        </span>
                        <Badge variant="outline">{job.specialty}</Badge>
                      </div>
                    </div>
                    {selectedJob.id === job.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Selected Job Details */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedJob.title}</CardTitle>
              <CardDescription>{selectedJob.organization}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedJob.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedJob.type}</span>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedJob.salaryRange}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{selectedJob.description}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Requirements</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {selectedJob.requirements.map((req, index) => (
                    <li key={index}>{req}</li>
                  ))}
                </ul>
              </div>

              {/* Widget Integration Area */}
              <div className="pt-4 border-t">
                {currentStep === 'select' && (
                  <Button className="w-full" onClick={() => { generateWidgetToken(); setCurrentStep('generate'); }}>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Start Widget Demo
                  </Button>
                )}

                {currentStep === 'generate' && (
                  <Button className="w-full" disabled onClick={generateWidgetToken}>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Generating Widget Token...
                  </Button>
                )}

                {currentStep === 'widget' && !applicationData && (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Widget Token Generated:</p>
                      <code className="text-xs break-all">{widgetToken}</code>
                    </div>
                    <Button className="w-full" onClick={handleApplyClick}>
                      Apply with VitalCV (Demo)
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      In production, clicking this would open the VitalCV widget
                    </p>
                  </div>
                )}

                {currentStep === 'complete' && (
                  <div className="space-y-3">
                    <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Application submitted successfully! See the payload on the right.
                      </AlertDescription>
                    </Alert>
                    <Button className="w-full" onClick={resetDemo} variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Another Job
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Code & Payload */}
        <div className="space-y-6">
          {/* Integration Code */}
          <Card>
            <CardHeader>
              <CardTitle>Widget Integration Code</CardTitle>
              <CardDescription>
                How to integrate the widget into your job page
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="html">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="react">React</TabsTrigger>
                </TabsList>

                <TabsContent value="html" className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        `<div id="vitalcv-widget" data-job-id="${selectedJob.id}" data-token="${widgetToken || 'YOUR_TOKEN'}"></div>
<script src="https://sandbox-widget.vitalcv.com/widget.js"></script>`,
                        'HTML code'
                      )}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                    <code>{`<div
  id="vitalcv-widget"
  data-job-id="${selectedJob.id}"
  data-token="${widgetToken || 'YOUR_TOKEN'}"
></div>

<script src="https://sandbox-widget.vitalcv.com/widget.js"></script>`}</code>
                  </pre>
                </TabsContent>

                <TabsContent value="react" className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        `import { VitalCVWidget } from '@vitalcv/react-widget';

<VitalCVWidget
  jobId="${selectedJob.id}"
  widgetToken="${widgetToken || 'YOUR_TOKEN'}"
  sandbox={true}
  onSuccess={(app) => console.log(app)}
/>`,
                        'React code'
                      )}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                    <code>{`import { VitalCVWidget } from '@vitalcv/react-widget';

<VitalCVWidget
  jobId="${selectedJob.id}"
  widgetToken="${widgetToken || 'YOUR_TOKEN'}"
  sandbox={true}
  onSuccess={(app) => console.log(app)}
/>`}</code>
                  </pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Application Payload */}
          {applicationData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Application Payload</CardTitle>
                    <CardDescription>
                      Data your system will receive via webhook
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(
                      JSON.stringify(applicationData, null, 2),
                      'Application payload'
                    )}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                  <code>{JSON.stringify(applicationData, null, 2)}</code>
                </pre>

                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="text-sm font-semibold mb-2">What happens next:</h4>
                  <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
                    <li>Your webhook receives this payload</li>
                    <li>Store the application in your ATS</li>
                    <li>Notify your hiring team</li>
                    <li>Begin your review process</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sample Data Notice */}
          {!applicationData && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-800 dark:text-orange-200">
                  Sample Data Notice
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-orange-800 dark:text-orange-300 space-y-2">
                <p>
                  ⚠️ All clinician data in this demo is <strong>fake and for testing only</strong>:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>NPIs start with "9" (test NPIs)</li>
                  <li>Names prefixed with "SAMPLE-"</li>
                  <li>Emails: @sandbox.vitalcv.com</li>
                  <li>No real credentials or PHI</li>
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

