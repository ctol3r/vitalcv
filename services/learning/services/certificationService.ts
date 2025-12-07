/**
 * B249B-LRN-016: CertificationService
 *
 * Issues certificates upon course completion: generates unique certificateId,
 * PDF certificate with user name, course, completion date; stores certificate records
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface Certificate {
  id: string;
  certificateId: string;
  enrollmentId: string;
  courseId: string;
  userId: string;
  userName: string;
  issuedAt: Date;
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CertificatePDFData {
  certificateId: string;
  userName: string;
  courseTitle: string;
  completionDate: Date;
  creditHours: number;
}

export class CertificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Issue certificate for a completed enrollment
   */
  async issueCertificate(enrollmentId: string): Promise<Certificate> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        course: true,
        user: true,
        certificate: true,
      },
    });

    if (!enrollment) {
      throw new Error(`Enrollment not found: ${enrollmentId}`);
    }

    if (enrollment.status !== 'completed') {
      throw new Error(`Cannot issue certificate for enrollment with status: ${enrollment.status}`);
    }

    if (enrollment.certificate) {
      // Certificate already issued
      return enrollment.certificate;
    }

    // Generate unique certificate ID
    const certificateId = this.generateCertificateId();

    // Generate PDF certificate
    const pdfData: CertificatePDFData = {
      certificateId,
      userName: enrollment.user.name,
      courseTitle: enrollment.course.title,
      completionDate: enrollment.completedAt || new Date(),
      creditHours: Number(enrollment.course.creditHours),
    };

    const pdfUrl = await this.generatePDFCertificate(pdfData);

    // Create certificate record
    const certificate = await this.prisma.certificate.create({
      data: {
        certificateId,
        enrollmentId: enrollment.id,
        courseId: enrollment.courseId,
        userId: enrollment.userId,
        userName: enrollment.user.name,
        pdfUrl,
        issuedAt: new Date(),
      },
    });

    return certificate;
  }

  /**
   * Get certificate by ID
   */
  async getCertificate(certificateId: string): Promise<Certificate | null> {
    return this.prisma.certificate.findUnique({
      where: { certificateId },
    });
  }

  /**
   * Get certificate by enrollment ID
   */
  async getCertificateByEnrollment(enrollmentId: string): Promise<Certificate | null> {
    return this.prisma.certificate.findUnique({
      where: { enrollmentId },
    });
  }

  /**
   * Get user's certificates
   */
  async getUserCertificates(userId: string): Promise<Certificate[]> {
    return this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      include: {
        course: true,
      },
    });
  }

  /**
   * Verify certificate validity
   */
  async verifyCertificate(certificateId: string): Promise<{
    valid: boolean;
    certificate?: Certificate;
    error?: string;
  }> {
    const certificate = await this.prisma.certificate.findUnique({
      where: { certificateId },
      include: {
        enrollment: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!certificate) {
      return {
        valid: false,
        error: 'Certificate not found',
      };
    }

    // Verify enrollment is still completed
    if (certificate.enrollment.status !== 'completed') {
      return {
        valid: false,
        error: 'Enrollment is no longer completed',
      };
    }

    return {
      valid: true,
      certificate,
    };
  }

  /**
   * Generate unique certificate ID
   */
  private generateCertificateId(): string {
    // Format: CERT-{timestamp}-{uuid}
    const timestamp = Date.now().toString(36).toUpperCase();
    const uuid = uuidv4().split('-')[0].toUpperCase();
    return `CERT-${timestamp}-${uuid}`;
  }

  /**
   * Generate PDF certificate
   * In a real implementation, this would use a PDF library like pdfkit or puppeteer
   */
  private async generatePDFCertificate(data: CertificatePDFData): Promise<string> {
    // This is a placeholder - in production, you would:
    // 1. Use a PDF generation library (pdfkit, puppeteer, etc.)
    // 2. Create a certificate template
    // 3. Fill in the data
    // 4. Upload to S3 or storage
    // 5. Return the URL

    // For now, return a placeholder URL
    // In production, implement actual PDF generation:
    /*
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');

    const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape' });
    const filename = `certificate-${data.certificateId}.pdf`;
    const filepath = path.join('/tmp', filename);

    doc.pipe(fs.createWriteStream(filepath));

    // Add certificate design
    doc.fontSize(24).text('Certificate of Completion', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text(`This certifies that ${data.userName}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(`has successfully completed`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(20).text(data.courseTitle, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Completed on ${data.completionDate.toLocaleDateString()}`, { align: 'center' });
    doc.fontSize(12).text(`Credit Hours: ${data.creditHours}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Certificate ID: ${data.certificateId}`, { align: 'center' });

    doc.end();

    // Upload to S3
    const s3Url = await this.uploadToS3(filepath, filename);
    return s3Url;
    */

    // Placeholder return
    return `https://cdn.example.com/certificates/${data.certificateId}.pdf`;
  }

  /**
   * Upload PDF to S3 (placeholder)
   */
  private async uploadToS3(filepath: string, filename: string): Promise<string> {
    // In production, implement S3 upload
    // For now, return placeholder URL
    return `https://cdn.example.com/certificates/${filename}`;
  }
}

