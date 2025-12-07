import { Router } from 'express';
import multer from 'multer';
import { faceEmbeddingService } from '../services/face/embeddings';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const MATCH_THRESHOLD = 0.8;

router.post(
  '/face-match',
  upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'documentPhoto', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const selfieFile = files['selfie']?.[0];
      const docFile = files['documentPhoto']?.[0];

      if (!selfieFile || !docFile) {
        return res.status(400).json({ error: 'Missing selfie or documentPhoto' });
      }

      // Compute embeddings using the buffers directly from memory storage
      const selfieResult = await faceEmbeddingService.computeSelfieVector(selfieFile.buffer);
      const docResult = await faceEmbeddingService.computeDocumentVector(docFile.buffer);

      // Compare
      const similarity = faceEmbeddingService.calculateCosineSimilarity(
        selfieResult.vector,
        docResult.vector
      );

      const passed = similarity >= MATCH_THRESHOLD;

      return res.json({
        matchScore: similarity,
        thresholdCheck: passed ? 'pass' : 'fail',
      });
    } catch (err: any) {
      console.error('Face match error:', err);
      return res.status(500).json({ error: 'Internal server error processing face match' });
    }
  }
);

export default router;


