import { Router } from 'express';
import path from 'path';
import express from 'express';

export const staticPub = Router();

staticPub.use('/', express.static(path.join(process.cwd(), 'public')));

