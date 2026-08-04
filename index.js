const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://ophim1.com/'
};

// Hàm lấy dữ liệu theo danh mục
async function fetchMovies(endpoint, page = 1) {
    const url = `https://ophim1.com/v1/api/danh-sach/${endpoint}?page=${page}`;
    const response = await axios.get(url, { headers: HEADERS });
    const items = response.data?.data?.items || [];
    const cdnUrl = response.data?.data?.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live/uploads/movies/';

    return items.map(item => ({
        title: item.name,
        slug: item.slug,
        poster: `${cdnUrl}${item.poster_url}`
    }));
}

// 1. LINK PLAYLIST M3U TỔNG HỢP (GỘP CẢ PHIM BỘ VÀ PHIM LẺ)
app.get('/playlist.m3u', async (req, res) => {
    try {
        // Lấy dữ liệu từ cả 2 danh mục (mỗi loại 20 phim)
        const [phimBo, phimLe] = await Promise.all([
            fetchMovies('phim-bo', 1),
            fetchMovies('phim-le', 1)
        ]);

        let m3u = '#EXTM3U\n';

        // Thêm nhóm Phim Bộ
        phimBo.slice(0, 20).forEach(movie => {
            const streamUrl = `https://${req.get('host')}/api/get-stream?slug=${movie.slug}`;
            m3u += `#EXTINF:-1 group-title="Phim Bộ" tvg-logo="${movie.poster}", ${movie.title}\n`;
            m3u += `${streamUrl}\n`;
        });

        // Thêm nhóm Phim Lẻ
        phimLe.slice(0, 20).forEach(movie => {
            const streamUrl = `https://${req.get('host')}/api/get-stream?slug=${movie.slug}`;
            m3u += `#EXTINF:-1 group-title="Phim Lẻ" tvg-logo="${movie.poster}", ${movie.title}\n`;
            m3u += `${streamUrl}\n`;
        });

        res.setHeader('Content-Type', 'audio/x-mpegurl');
        res.send(m3u);
    } catch (error) {
        res.status(500).send('#EXTM3U\n# Error loading playlist');
    }
});

// 2. API DẠNG JSON GỘP CẢ 2 DANH MỤC
app.get('/api/all-movies', async (req, res) => {
    try {
        const [phimBo, phimLe] = await Promise.all([
            fetchMovies('phim-bo', 1),
            fetchMovies('phim-le', 1)
        ]);

        res.json({
            status: 'success',
            phim_bo: phimBo.slice(0, 20),
            phim_le: phimLe.slice(0, 20)
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 3. API LẤY LINK PHÁT STREAM M3U8
app.get('/api/get-stream', async (req, res) => {
    const slug = req.query.slug || req.query.url;
    if (!slug) return res.status(400).send('Missing slug');

    try {
        const cleanSlug = slug.includes('/') ? slug.split('/').pop() : slug;
        const { data } = await axios.get(`https://ophim1.com/phim/${cleanSlug}`, { headers: HEADERS });
        
        const episodes = data.episodes || [];
        let streamUrl = '';

        if (episodes.length > 0 && episodes[0].server_data.length > 0) {
            streamUrl = episodes[0].server_data[0].link_m3u8;
        }

        if (streamUrl) {
            res.redirect(streamUrl);
        } else {
            res.status(404).send('Stream not found');
        }
    } catch (error) {
        res.status(500).send('Error getting stream');
    }
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
