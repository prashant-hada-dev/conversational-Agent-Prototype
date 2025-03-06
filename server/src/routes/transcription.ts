import express from 'express';
import multer from 'multer';
import { transcriptionService } from '../services/transcription.service';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Received audio file:', {
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    const transcription = await transcriptionService.transcribeAudio(req.file.buffer);
    
    console.log('Transcription result:', transcription);
    
    res.json({ text: transcription });
  } catch (error) {
    console.error('Transcription route error:', error);
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;