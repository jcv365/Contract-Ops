import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AttachmentKind } from '@prisma/client';
import { saveAttachment, listAttachments, AttachmentNotFoundError } from '../../modules/attachments/service';
import { validateAttachment } from '../../modules/graph/attachment-validation';

export const attachmentsRouter = Router();

const DEFAULT_USER_ID = 'default-user'; // matches the single-user convention used throughout (portal/router.ts, db/seed.ts)

// In-memory only — files are small (10MB cap, enforced below) and this
// avoids a second temp-file write before the real one in
// attachments/service.ts. Multer is mounted only on this route, not
// globally, so it never interferes with express.json()/urlencoded()
// elsewhere in the app.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /attachments — what's currently on file for the default user.
attachmentsRouter.get('/', async (req, res, next) => {
  try {
    const attachments = await listAttachments(DEFAULT_USER_ID);
    res.json({ attachments });
  } catch (err) {
    next(err);
  }
});

// POST /attachments (multipart/form-data: file, kind) — validates content
// (not just declared mimeType — see attachment-validation.ts's content
// sniffing) before ever writing to disk.
attachmentsRouter.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded (expected multipart field "file")' });
      return;
    }
    const kind = Object.values(AttachmentKind).includes(req.body.kind) ? (req.body.kind as AttachmentKind) : AttachmentKind.OTHER;

    const check = validateAttachment({ mimeType: req.file.mimetype, sizeBytes: req.file.size }, undefined, req.file.buffer);
    if (!check.valid) {
      res.status(422).json({ error: check.reason });
      return;
    }

    const attachment = await saveAttachment({
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      kind,
      ownerId: DEFAULT_USER_ID,
    });
    res.status(201).json(attachment);
  } catch (err) {
    next(err);
  }
});

attachmentsRouter.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AttachmentNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  next(err);
});
