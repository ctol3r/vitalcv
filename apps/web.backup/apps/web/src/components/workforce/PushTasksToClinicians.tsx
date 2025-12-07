/**
 * Push Tasks to Clinicians Component
 * Phase 5: Task 34 - Ability to push tasks to clinicians directly
 */

'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Users, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  clinicianIds: string[];
}

export function PushTasksToClinicians() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sending, setSending] = useState(false);

  const handleSendTask = async (task: Task) => {
    setSending(true);
    // TODO: Implement task sending to clinicians
    setTimeout(() => {
      setSending(false);
      alert(`Task "${task.title}" sent to ${task.clinicianIds.length} clinician(s)`);
    }, 1000);
  };

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Update DEA Registration',
      description: 'DEA registration expires in 30 days',
      priority: 'high',
      clinicianIds: ['clinician-1', 'clinician-2'],
    },
    {
      id: 'task-2',
      title: 'Complete CME Credits',
      description: '12 CME credits required for board certification renewal',
      priority: 'medium',
      clinicianIds: ['clinician-3'],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Active Tasks</h4>
        <Button variant="outline" size="sm">
          Create New Task
        </Button>
      </div>
      <div className="space-y-2">
        {mockTasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{task.title}</span>
                <Badge
                  variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                >
                  {task.priority}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{task.description}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{task.clinicianIds.length} clinician(s)</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSendTask(task)}
              disabled={sending}
              className="gap-2"
            >
              <Send className="h-3 w-3" />
              Send
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}








