import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import urlRoutes, { handleRedirect } from './routes/urls.js';
import analyticsRoutes from './routes/analytics.js';
import { authenticate } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10kb' }));
app.use(morgan('combined'));

// Rate limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // strict — prevent brute-force login attempts
    message: { error: 'Too many attempts, try again later' },
});

const shortenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many requests, slow down' },
});

const redirectLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes — public (you're not logged in yet)
app.use('/api/auth', authLimiter, authRoutes);

// Protected routes — must have valid JWT
app.use('/api/urls', authenticate, shortenLimiter, urlRoutes);
app.use('/api/analytics', authenticate, analyticsRoutes);

// Redirect route — public, must come last
app.get('/:code([a-zA-Z0-9_-]{3,20})', redirectLimiter, handleRedirect);

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔗 URL Shortener API running on port ${PORT}`);
});// trigger backend ci 
