'use client'

import { useMemo, useState } from 'react'
import {
  BookOpen,
  User,
  Clock,
  DollarSign,
  Star,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  Users,
  FileText,
  Award,
  ArrowLeft,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

type CourseInstructor = {
  id: string
  name: string
  title: string
  bio: string
  credentials: string[]
  rating: number
}

type CourseModule = {
  id: string
  title: string
  description: string
  duration: string
  type: 'video' | 'reading' | 'quiz' | 'assignment'
}

type CourseReview = {
  id: string
  author: string
  rating: number
  comment: string
  date: string
  verified: boolean
}

type TrainingCourse = {
  id: string
  title: string
  description: string
  longDescription: string
  specialty: string
  provider: string
  cost: number
  vitaPrice?: number
  rating: number
  reviewCount: number
  totalDuration: string
  format: 'online' | 'in-person' | 'hybrid'
  level: 'beginner' | 'intermediate' | 'advanced'
  instructor: CourseInstructor
  syllabus: CourseModule[]
  prerequisites: string[]
  outcomes: string[]
  schedule: {
    startDate: string
    endDate: string
    sessions: Array<{
      date: string
      time: string
      duration: string
      location?: string
    }>
  }
  reviews: CourseReview[]
}

type TrainingCoursePageProps = {
  courseId?: string
}

export default function TrainingCoursePage({ courseId = 'course1' }: TrainingCoursePageProps) {
  const [selectedRating, setSelectedRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [reviewAuthor, setReviewAuthor] = useState('')

  const course = useMemo(() => buildMockCourse(courseId), [courseId])

  const handleEnroll = () => {
    // TODO: Implement enrollment logic
    console.log('Enrolling in course:', course.id)
  }

  const handleSubmitReview = () => {
    // TODO: Implement review submission
    console.log('Submitting review:', { rating: selectedRating, comment: reviewText, author: reviewAuthor })
    setReviewText('')
    setReviewAuthor('')
    setSelectedRating(0)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <div className="space-y-4">
        <Link href="/demo/training/catalog">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Catalog
          </Button>
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {course.specialty}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {course.level}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {course.format}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold">{course.title}</h1>
            <p className="text-muted-foreground text-lg">{course.description}</p>
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{course.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">({course.reviewCount} reviews)</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{course.totalDuration}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{course.provider}</span>
              </div>
            </div>
          </div>

          <Card className="lg:w-80">
            <CardHeader>
              <CardTitle>Enrollment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {course.cost === 0 ? 'Free' : `$${course.cost}`}
                  </span>
                  {course.vitaPrice && (
                    <span className="text-sm text-muted-foreground">
                      or {course.vitaPrice} VITA
                    </span>
                  )}
                </div>
              </div>
              <Button onClick={handleEnroll} className="w-full" size="lg">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Enroll Now
              </Button>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Starts: {course.schedule.startDate}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Ends: {course.schedule.endDate}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Course Details Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
          <TabsTrigger value="instructor">Instructor</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>About This Course</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-line">{course.longDescription}</p>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Learning Outcomes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {course.outcomes.map((outcome, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-sm">{outcome}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  Prerequisites
                </CardTitle>
              </CardHeader>
              <CardContent>
                {course.prerequisites.length > 0 ? (
                  <ul className="space-y-2">
                    {course.prerequisites.map((prereq, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-sm">{prereq}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No prerequisites required.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="syllabus" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Course Syllabus</CardTitle>
              <CardDescription>Detailed breakdown of course modules and content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {course.syllabus.map((module, index) => (
                  <div key={module.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Module {index + 1}</Badge>
                          <Badge variant="secondary" className="capitalize">
                            {module.type}
                          </Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {module.duration}
                          </span>
                        </div>
                        <h3 className="font-semibold">{module.title}</h3>
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Instructor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{course.instructor.name}</h3>
                <p className="text-muted-foreground">{course.instructor.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{course.instructor.rating.toFixed(1)}</span>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">About</h4>
                <p className="text-sm text-muted-foreground">{course.instructor.bio}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Credentials</h4>
                <div className="flex flex-wrap gap-2">
                  {course.instructor.credentials.map((cred, index) => (
                    <Badge key={index} variant="secondary">
                      {cred}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Course Schedule
              </CardTitle>
              <CardDescription>
                {course.schedule.startDate} - {course.schedule.endDate}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {course.schedule.sessions.map((session, index) => (
                  <div key={index} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium">{session.date}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.time} • {session.duration}
                        {session.location && ` • ${session.location}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <div className="space-y-4">
            {/* Review Form */}
            <Card>
              <CardHeader>
                <CardTitle>Write a Review</CardTitle>
                <CardDescription>Share your experience with this course</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Rating</Label>
                  <div className="flex gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setSelectedRating(rating)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`h-6 w-6 ${
                            rating <= selectedRating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="review-author">Your Name</Label>
                  <Input
                    id="review-author"
                    value={reviewAuthor}
                    onChange={(e) => setReviewAuthor(e.target.value)}
                    placeholder="Enter your name"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="review-text">Your Review</Label>
                  <Textarea
                    id="review-text"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Share your thoughts about this course..."
                    rows={5}
                    className="mt-2"
                  />
                </div>
                <Button onClick={handleSubmitReview} disabled={!reviewText.trim() || selectedRating === 0}>
                  Submit Review
                </Button>
              </CardContent>
            </Card>

            {/* Reviews List */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Course Reviews</h3>
              {course.reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{review.author}</span>
                          {review.verified && (
                            <Badge variant="outline" className="text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <Star
                              key={rating}
                              className={`h-4 w-4 ${
                                rating <= review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.date}</p>
                      <p className="text-sm">{review.comment}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function buildMockCourse(courseId: string): TrainingCourse {
  return {
    id: courseId,
    title: 'Advanced Cardiac Life Support (ACLS)',
    description: 'Comprehensive ACLS certification course covering advanced life support techniques and protocols.',
    longDescription: `This comprehensive Advanced Cardiac Life Support (ACLS) course is designed for healthcare professionals who need to respond to cardiovascular emergencies. The course covers the latest guidelines and protocols for managing cardiac arrest, stroke, and other life-threatening emergencies.

You'll learn through a combination of interactive lectures, hands-on practice sessions, and simulation scenarios. The course emphasizes team dynamics, effective communication, and evidence-based interventions.

Upon successful completion, you'll receive ACLS certification valid for two years, along with continuing education credits.`,
    specialty: 'Cardiology',
    provider: 'American Heart Association',
    cost: 250,
    vitaPrice: 200,
    rating: 4.8,
    reviewCount: 342,
    totalDuration: '2 days (16 hours)',
    format: 'hybrid',
    level: 'intermediate',
    instructor: {
      id: 'instructor1',
      name: 'Dr. Jennifer Martinez',
      title: 'ACLS Certified Instructor',
      bio: 'Dr. Martinez has been teaching ACLS courses for over 10 years and has trained thousands of healthcare professionals. She is a practicing emergency medicine physician with extensive experience in cardiac emergencies.',
      credentials: ['MD', 'ACLS Instructor', 'BLS Instructor', 'Emergency Medicine Board Certified'],
      rating: 4.9,
    },
    syllabus: [
      {
        id: 'module1',
        title: 'Introduction to ACLS',
        description: 'Overview of ACLS protocols, team dynamics, and the chain of survival.',
        duration: '2 hours',
        type: 'video',
      },
      {
        id: 'module2',
        title: 'Basic Life Support Review',
        description: 'Review of BLS techniques including chest compressions and rescue breathing.',
        duration: '1 hour',
        type: 'video',
      },
      {
        id: 'module3',
        title: 'Cardiac Arrest Algorithms',
        description: 'Detailed study of ACLS algorithms for different cardiac arrest scenarios.',
        duration: '3 hours',
        type: 'reading',
      },
      {
        id: 'module4',
        title: 'Pharmacology in ACLS',
        description: 'Understanding medications used in ACLS and their administration.',
        duration: '2 hours',
        type: 'video',
      },
      {
        id: 'module5',
        title: 'Practical Skills Practice',
        description: 'Hands-on practice with ACLS scenarios and team-based simulations.',
        duration: '4 hours',
        type: 'assignment',
      },
      {
        id: 'module6',
        title: 'Final Assessment',
        description: 'Written and practical examination to demonstrate competency.',
        duration: '2 hours',
        type: 'quiz',
      },
    ],
    prerequisites: [
      'Current BLS certification',
      'Basic understanding of cardiac rhythms',
      'Healthcare provider license',
    ],
    outcomes: [
      'Recognize and manage cardiac arrest scenarios',
      'Apply ACLS algorithms effectively',
      'Demonstrate proper use of ACLS medications',
      'Work effectively as part of a resuscitation team',
      'Obtain ACLS certification',
    ],
    schedule: {
      startDate: '2025-12-01',
      endDate: '2025-12-02',
      sessions: [
        {
          date: '2025-12-01',
          time: '9:00 AM - 5:00 PM',
          duration: '8 hours',
          location: 'Training Center A',
        },
        {
          date: '2025-12-02',
          time: '9:00 AM - 5:00 PM',
          duration: '8 hours',
          location: 'Training Center A',
        },
      ],
    },
    reviews: [
      {
        id: 'review1',
        author: 'Dr. John Smith',
        rating: 5,
        comment: 'Excellent course! The instructor was knowledgeable and the hands-on practice was invaluable.',
        date: '2025-11-01',
        verified: true,
      },
      {
        id: 'review2',
        author: 'Sarah Johnson, RN',
        rating: 4,
        comment: 'Very comprehensive and well-structured. The online materials were helpful for review.',
        date: '2025-10-28',
        verified: true,
      },
      {
        id: 'review3',
        author: 'Michael Chen, MD',
        rating: 5,
        comment: 'Best ACLS course I\'ve taken. The simulation scenarios were realistic and challenging.',
        date: '2025-10-15',
        verified: true,
      },
    ],
  }
}

