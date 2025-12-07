'use client'

import { useState, useMemo } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronLeft,
  Save,
  FileText,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type QuestionType = 'yes_no' | 'multiple_choice' | 'text' | 'scale'

type Question = {
  id: string
  text: string
  type: QuestionType
  options?: string[]
  required: boolean
  context?: string
  example?: string
}

type ObligationGroup = {
  id: string
  title: string
  description: string
  questions: Question[]
}

type Answer = {
  questionId: string
  value: string | string[] | number
}

type SelfAssessmentWizardProps = {
  obligationGroups: ObligationGroup[]
  onComplete?: (answers: Record<string, Answer>) => void
  initialAnswers?: Record<string, Answer>
}

export function SelfAssessmentWizard({
  obligationGroups,
  onComplete,
  initialAnswers = {},
}: SelfAssessmentWizardProps) {
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>(initialAnswers)
  const [showSummary, setShowSummary] = useState(false)

  const currentGroup = obligationGroups[currentGroupIndex]
  const totalQuestions = obligationGroups.reduce((sum, group) => sum + group.questions.length, 0)
  const answeredQuestions = Object.keys(answers).length
  const progress = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0

  const handleAnswer = (questionId: string, value: string | string[] | number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { questionId, value },
    }))
  }

  const handleNext = () => {
    if (currentGroupIndex < obligationGroups.length - 1) {
      setCurrentGroupIndex(currentGroupIndex + 1)
    } else {
      setShowSummary(true)
    }
  }

  const handlePrevious = () => {
    if (currentGroupIndex > 0) {
      setCurrentGroupIndex(currentGroupIndex - 1)
    }
  }

  const handleSave = () => {
    // In a real app, this would save to the backend
    console.log('Saving progress...', answers)
  }

  const handleComplete = () => {
    onComplete?.(answers)
  }

  const getAnswer = (questionId: string): Answer | undefined => {
    return answers[questionId]
  }

  const isGroupComplete = (group: ObligationGroup): boolean => {
    return group.questions.every((q) => {
      if (!q.required) return true
      const answer = getAnswer(q.id)
      return answer !== undefined && answer.value !== '' && answer.value !== null
    })
  }

  const summary = useMemo(() => {
    const total = totalQuestions
    const answered = answeredQuestions
    const required = obligationGroups.reduce(
      (sum, group) => sum + group.questions.filter((q) => q.required).length,
      0,
    )
    const requiredAnswered = obligationGroups.reduce((sum, group) => {
      return (
        sum +
        group.questions.filter((q) => {
          if (!q.required) return false
          const answer = getAnswer(q.id)
          return answer !== undefined && answer.value !== '' && answer.value !== null
        }).length
      )
    }, 0)

    return {
      total,
      answered,
      required,
      requiredAnswered,
      completionRate: total > 0 ? Math.round((answered / total) * 100) : 0,
      requiredCompletionRate: required > 0 ? Math.round((requiredAnswered / required) * 100) : 0,
    }
  }, [totalQuestions, answeredQuestions, obligationGroups, answers])

  if (showSummary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            Assessment Summary
          </CardTitle>
          <CardDescription>Review your responses and complete the assessment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Questions</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Answered</p>
              <p className="text-2xl font-bold">{summary.answered}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Completion</p>
              <p className="text-2xl font-bold">{summary.completionRate}%</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Responses by Obligation</h3>
            {obligationGroups.map((group) => {
              const groupAnswers = group.questions.filter((q) => getAnswer(q.id) !== undefined).length
              const groupTotal = group.questions.length
              const isComplete = isGroupComplete(group)

              return (
                <div key={group.id} className="rounded-md border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{group.title}</h4>
                    <Badge variant="outline" className={isComplete ? 'border-emerald-300 text-emerald-900' : 'border-amber-300 text-amber-900'}>
                      {groupAnswers}/{groupTotal} answered
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                </div>
              )
            })}
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowSummary(false)}>
              <ChevronLeft className="h-4 w-4 mr-2" aria-hidden="true" />
              Back to Questions
            </Button>
            <Button onClick={handleComplete} className="flex-1">
              <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
              Complete Assessment
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Obligation {currentGroupIndex + 1} of {obligationGroups.length}
              </span>
              <span className="font-medium">
                {answeredQuestions} of {totalQuestions} questions answered
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Current Obligation Group */}
      <Card>
        <CardHeader>
          <CardTitle>{currentGroup.title}</CardTitle>
          <CardDescription>{currentGroup.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentGroup.questions.map((question) => {
            const answer = getAnswer(question.id)

            return (
              <div key={question.id} className="space-y-3">
                <div className="flex items-start gap-2">
                  <label className="font-medium flex-1">
                    {question.text}
                    {question.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                </div>

                {question.context && (
                  <div className="rounded-md bg-muted p-3 flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">{question.context}</p>
                  </div>
                )}

                {question.example && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-medium text-amber-900 mb-1">Example:</p>
                    <p className="text-sm text-amber-800">{question.example}</p>
                  </div>
                )}

                {/* Question Input */}
                <div className="ml-4">
                  {question.type === 'yes_no' && (
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={question.id}
                          value="yes"
                          checked={answer?.value === 'yes'}
                          onChange={(e) => handleAnswer(question.id, e.target.value)}
                          className="h-4 w-4"
                        />
                        <span>Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={question.id}
                          value="no"
                          checked={answer?.value === 'no'}
                          onChange={(e) => handleAnswer(question.id, e.target.value)}
                          className="h-4 w-4"
                        />
                        <span>No</span>
                      </label>
                    </div>
                  )}

                  {question.type === 'multiple_choice' && question.options && (
                    <div className="space-y-2">
                      {question.options.map((option) => (
                        <label key={option} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={question.id}
                            value={option}
                            checked={answer?.value === option}
                            onChange={(e) => handleAnswer(question.id, e.target.value)}
                            className="h-4 w-4"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {question.type === 'text' && (
                    <Textarea
                      value={(answer?.value as string) || ''}
                      onChange={(e) => handleAnswer(question.id, e.target.value)}
                      placeholder="Enter your response..."
                      rows={4}
                    />
                  )}

                  {question.type === 'scale' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <label key={value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={question.id}
                              value={value.toString()}
                              checked={answer?.value === value.toString()}
                              onChange={(e) => handleAnswer(question.id, parseInt(e.target.value))}
                              className="h-4 w-4"
                            />
                            <span>{value}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Not at all</span>
                        <span>Completely</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="px-6 pb-6 flex items-center justify-between border-t pt-6">
          <Button variant="outline" onClick={handlePrevious} disabled={currentGroupIndex === 0}>
            <ChevronLeft className="h-4 w-4 mr-2" aria-hidden="true" />
            Previous
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" aria-hidden="true" />
              Save Progress
            </Button>
            <Button onClick={handleNext}>
              {currentGroupIndex < obligationGroups.length - 1 ? (
                <>
                  Next <ChevronRight className="h-4 w-4 ml-2" aria-hidden="true" />
                </>
              ) : (
                <>
                  Review Summary <ChevronRight className="h-4 w-4 ml-2" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Obligation Groups Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Obligation Groups</CardTitle>
          <CardDescription>Navigate between different compliance obligations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {obligationGroups.map((group, index) => {
              const isComplete = isGroupComplete(group)
              const isCurrent = index === currentGroupIndex

              return (
                <button
                  key={group.id}
                  onClick={() => setCurrentGroupIndex(index)}
                  className={cn(
                    'w-full text-left rounded-md border p-3 transition-colors',
                    isCurrent && 'border-primary bg-primary/5',
                    !isCurrent && 'hover:bg-muted',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      )}
                      <span className="font-medium">{group.title}</span>
                    </div>
                    <Badge variant="outline" className={isComplete ? 'border-emerald-300 text-emerald-900' : 'border-amber-300 text-amber-900'}>
                      {isComplete ? 'Complete' : 'Incomplete'}
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

