const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://ophim1.com/'
};

// 1. Cấu hình JSON cho Monplayer
app.get(['/', '/monplayer', '/index.json'], (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    res.json({
        urls: [
            {
                name: "📺 PHIM BỘ OPHIM",
                url: `${baseUrl}/api/cms?type=phim-bo`
            },
            {
                name: "🎬 PHIM LẺ OPHIM",
                url: `${baseUrl}/api/cms?type=phim-le`
            }
        ]
    });
});

// 2. API trả dữ liệu danh sách phim
app.get('/api/cms', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const type = req.query.type || 'phim-bo';
    const page = req.query.pg || 1;

    try {
        const url = `https://ophim1.com/v1/api/danh-sach/${type}?page=${page}`;
        const response = await axios.get(url, { headers: HEADERS, timeout: 5000 });
        const items = response.data?.data?.items || [];
        const cdnUrl = response.data?.data?.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live/uploads/movies/';

        const movies = items.map(item => ({
            vod_id: item.slug,
            vod_name: item.name,
            vod_pic: `${cdnUrl}${item.poster_url}`,
            vod_remarks: item.episode_current || ''
        }));

        res.json({
            code: 1,
            msg: "ok",
            page: Number(page),
            pagecount: 100,
            limit: movies.length,
            total: 2000,
            list: movies
        });
    } catch (error) {
        res.status(500).json({ code: 0, msg: "Lỗi kết nối", list: [] });
    }
});

app.listen(PORT, () => console.log(`Server ready on port ${PORT}`));
module.exports = app;
