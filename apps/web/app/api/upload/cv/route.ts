import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only PDF and DOC files are allowed." }, { status: 400 })
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 })
    }

    // TODO(@backend-integration): Replace with actual backend call
    // STUB: For now, simulate CV parsing
    const mockParsedData = {
      personalInfo: {
        name: "Dr. Sarah Johnson",
        email: "sarah.johnson@email.com",
        phone: "(555) 123-4567",
        address: "123 Medical Center Dr, Healthcare City, HC 12345",
      },
      education: [
        {
          degree: "Doctor of Medicine (MD)",
          institution: "Harvard Medical School",
          year: "2015",
          gpa: "3.9",
        },
        {
          degree: "Bachelor of Science in Biology",
          institution: "Stanford University",
          year: "2011",
          gpa: "3.8",
        },
      ],
      experience: [
        {
          position: "Attending Physician",
          organization: "General Hospital",
          startDate: "2018",
          endDate: "Present",
          description: "Internal Medicine specialist with focus on preventive care",
        },
        {
          position: "Resident Physician",
          organization: "University Medical Center",
          startDate: "2015",
          endDate: "2018",
          description: "Internal Medicine residency program",
        },
      ],
      licenses: [
        {
          type: "Medical License",
          number: "MD123456",
          state: "California",
          expirationDate: "2025-12-31",
          status: "Active",
        },
      ],
      certifications: [
        {
          name: "Board Certification in Internal Medicine",
          organization: "American Board of Internal Medicine",
          date: "2018",
          expirationDate: "2028",
        },
      ],
    }

    return NextResponse.json(
      {
        message: "CV uploaded and parsed successfully",
        parsed: mockParsedData,
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("CV upload error:", error)
    return NextResponse.json({ error: "Failed to process CV" }, { status: 500 })
  }
}
