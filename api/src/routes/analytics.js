import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET /api/analytics/summary — stats for the LOGGED-IN user only
router.get('/summary', async (req, res) => {
    const userId = req.user.userId;

    try {
        const [totals, recent, topUrls] = await Promise.all([
            query(`
        SELECT
          (SELECT COUNT(*) FROM urls WHERE is_active = true AND user_id = $1) AS total_urls,
          (SELECT COUNT(*) FROM analytics a JOIN urls u ON u.id = a.url_id WHERE u.user_id = $1) AS total_clicks,
          (SELECT COUNT(*) FROM analytics a JOIN urls u ON u.id = a.url_id WHERE u.user_id = $1 AND a.clicked_at > NOW() - INTERVAL '24 hours') AS clicks_today,
          (SELECT COUNT(*) FROM analytics a JOIN urls u ON u.id = a.url_id WHERE u.user_id = $1 AND a.clicked_at > NOW() - INTERVAL '7 days') AS clicks_week
      `, [userId]),

            query(`
        SELECT DATE(a.clicked_at) AS day, COUNT(*) AS count
        FROM analytics a
        JOIN urls u ON u.id = a.url_id
        WHERE u.user_id = $1 AND a.clicked_at > NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
      `, [userId]),

            query(`
        SELECT u.short_code, u.original_url, u.title,
               COUNT(a.id) AS clicks
        FROM urls u
        LEFT JOIN analytics a ON a.url_id = u.id
        WHERE u.is_active = true AND u.user_id = $1
        GROUP BY u.id
        ORDER BY clicks DESC
        LIMIT 5
      `, [userId]),
        ]);

        return res.json({
            summary: totals.rows[0],
            click_history: recent.rows,
            top_urls: topUrls.rows,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

export default router;