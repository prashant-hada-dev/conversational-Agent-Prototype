import express from 'express';
import path from 'path';
import { streamingTTSService } from '../services/streaming-tts.service';

const router = express.Router();

// Serve static audio files from audio directory
router.use('/', express.static(path.join(__dirname, '../../audio')));

// Generate greeting audio if it doesn't exist
router.get('/greeting.mp3', async (req, res) => {
  const greetingPath = path.join(__dirname, '../../audio/greeting.mp3');
  
  try {
    // Check if greeting file exists
    await streamingTTSService.generateAudio(
      "Hello! I'm your AI sales assistant. I'm ready to help you. You can speak naturally, and I'll respond when you pause.",
      greetingPath
    );
    res.sendFile(greetingPath);
  } catch (error) {
    console.error('Error generating greeting audio:', error);
    res.status(500).json({ error: 'Failed to generate greeting audio' });
  }
});

export default router;