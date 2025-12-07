'use client'

import { useEffect, useState } from 'react'
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  User,
  Edit,
  Columns,
  List,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string
  assignedTo?: string
  assignedToName?: string
  status: 'open' | 'in_progress' | 'blocked' | 'done'
  createdAt: string
  updatedAt: string
}

type ViewMode = 'list' | 'kanban'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dueDateFilter, setDueDateFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    assignedTo: '',
  })

  useEffect(() => {
    loadTasks()
  }, [])

  useEffect(() => {
    filterTasks()
  }, [tasks, searchQuery, statusFilter, dueDateFilter])

  async function loadTasks() {
    try {
      const response = await fetch('/api/partners/tasks')
      if (!response.ok) throw new Error('Failed to load tasks')
      const data = await response.json()
      setTasks(data.tasks || [])
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  function filterTasks() {
    let filtered = [...tasks]

    if (searchQuery) {
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((t) => t.status === statusFilter)
    }

    if (dueDateFilter !== 'all') {
      const now = new Date()
      filtered = filtered.filter((t) => {
        if (!t.dueDate) return dueDateFilter === 'no_date'
        const due = new Date(t.dueDate)
        switch (dueDateFilter) {
          case 'overdue':
            return due < now && t.status !== 'done'
          case 'today':
            return due.toDateString() === now.toDateString()
          case 'week':
            return due.getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000 && due >= now
          default:
            return true
        }
      })
    }

    setFilteredTasks(filtered)
  }

  async function handleCreate() {
    try {
      const response = await fetch('/api/partners/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to create task')

      setShowCreateDialog(false)
      setFormData({ title: '', description: '', dueDate: '', assignedTo: '' })
      await loadTasks()
    } catch (err) {
      console.error('Failed to create task:', err)
      alert('Failed to create task. Please try again.')
    }
  }

  async function handleUpdateStatus(taskId: string, newStatus: string) {
    try {
      const response = await fetch(`/api/partners/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error('Failed to update task')

      await loadTasks()
    } catch (err) {
      console.error('Failed to update task:', err)
      alert('Failed to update task. Please try again.')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      open: 'outline',
      in_progress: 'secondary',
      blocked: 'destructive',
      done: 'default',
    }
    return <Badge variant={variants[status] || 'outline'}>{status.replace('_', ' ')}</Badge>
  }

  const isOverdue = (dueDate?: string, status?: string) => {
    if (!dueDate || status === 'done') return false
    return new Date(dueDate) < new Date()
  }

  const kanbanColumns = [
    { id: 'open', title: 'Open', tasks: filteredTasks.filter((t) => t.status === 'open') },
    {
      id: 'in_progress',
      title: 'In Progress',
      tasks: filteredTasks.filter((t) => t.status === 'in_progress'),
    },
    {
      id: 'blocked',
      title: 'Blocked',
      tasks: filteredTasks.filter((t) => t.status === 'blocked'),
    },
    { id: 'done', title: 'Done', tasks: filteredTasks.filter((t) => t.status === 'done') },
  ]

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Collaboration Tasks</h1>
          <p className="text-muted-foreground">
            Manage tasks for partner collaboration
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-r-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="rounded-l-none"
            >
              <Columns className="h-4 w-4" />
            </Button>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Add a new collaboration task
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Review partnership proposal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Task details..."
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">Assigned To</Label>
                    <Input
                      id="assignedTo"
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      placeholder="User ID or email"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!formData.title.trim()}>
                  Create Task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
                <SelectTrigger>
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Due Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Due Today</SelectItem>
                  <SelectItem value="week">Due This Week</SelectItem>
                  <SelectItem value="no_date">No Due Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks View */}
      {viewMode === 'list' ? (
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading tasks...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tasks found. Create your first task to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{task.title}</div>
                          {task.description && (
                            <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.status}
                          onValueChange={(value) => handleUpdateStatus(task.id, value)}
                        >
                          <SelectTrigger className="w-36">
                            {getStatusBadge(task.status)}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {task.assignedToName || task.assignedTo || 'Unassigned'}
                      </TableCell>
                      <TableCell>
                        {task.dueDate ? (
                          <div className="flex items-center gap-2">
                            {new Date(task.dueDate).toLocaleDateString()}
                            {isOverdue(task.dueDate, task.status) && (
                              <Badge variant="destructive" className="text-xs">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        ) : (
                          'No due date'
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {kanbanColumns.map((column) => (
            <Card key={column.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {column.title} ({column.tasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {column.tasks.map((task) => (
                  <Card
                    key={task.id}
                    className="cursor-move hover:shadow-md transition-shadow"
                  >
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="font-medium">{task.title}</div>
                        {task.description && (
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {task.description}
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString()}
                            {isOverdue(task.dueDate, task.status) && (
                              <Badge variant="destructive" className="text-xs ml-1">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        )}
                        {task.assignedToName && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.assignedToName}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {column.tasks.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No tasks
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

