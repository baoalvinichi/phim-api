const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://ophim1.com/'
};

// Hàm lấy dữ liệu từ nguồn phim
async function fetchMovies(endpoint, page = 1) {
    try {
        const url = `https://ophim1.com/v1/api/danh-sach/${endpoint}?page=${page}`;
        const response = await axios.get(url, { headers: HEADERS, timeout: 8000 });
        const items = response.data?.data?.items || [];
        const cdnUrl = response.data?.data?.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live/uploads/movies/';

        return items.map(item => ({
            title: item.name ? item.name.replace(/,/g, ' -') : 'Phim',
            slug: item.slug,
            poster: `${cdnUrl}${item.poster_url}`
        }));
    } catch (e) {
        return [];
    }
}

// 1. Route Playlist M3U tổng hợp dành cho TiviMate
app.get(['/playlist.m3u', '/playlist.m3u8', '/tivimate.m3u'], async (req, res) => {
    try {
        const [phimBo, phimLe] = await Promise.all([
            fetchMovies('phim-bo', 1),
            fetchMovies('phim-le', 1)
        ]);

        let m3u = '#EXTM3U\n';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // Thêm danh mục Phim Bộ
        phimBo.slice(0, 20).forEach(movie => {
            const streamUrl = `${baseUrl}/api/get-stream?slug=${movie.slug}`;
            m3u += `#EXTINF:-1 group-title="PHIM BỘ" tvg-logo="${movie.poster}", ${movie.title}\n`;
            m3u += `${streamUrl}\n`;
        });

        // Thêm danh mục Phim Lẻ
        phimLe.slice(0, 20).forEach(movie => {
            const streamUrl = `${baseUrl}/api/get-stream?slug=${movie.slug}`;
            m3u += `#EXTINF:-1 group-title="PHIM LẺ" tvg-logo="${movie.poster}", ${movie.title}\n`;
            m3u += `${streamUrl}\n`;
        });

        res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="playlist.m3u"');
        res.status(200).send(m3u);
    } catch (error) {
        res.status(500).send('#EXTM3U\n# Error');
    }
});

// 2. Route chuyển hướng trực tiếp đến luồng video m3u8
app.get('/api/get-stream', async (req, res) => {
    const slug = req.query.slug || req.query.url;
    if (!slug) return res.status(400).send('Missing slug');

    try {
        const cleanSlug = slug.includes('/') ? slug.split('/').pop() : slug;
        const { data } = await axios.get(`https://ophim1.com/phim/${cleanSlug}`, { headers: HEADERS, timeout: 5000 });
        
        const episodes = data.episodes || [];
        let streamUrl = '';

        if (episodes.length > 0 && episodes[0].server_data.length > 0) {
            streamUrl = episodes[0].server_data[0].link_m3u8;
        }

        if (streamUrl) {
            res.redirect(302, streamUrl);
        } else {
            res.status(404).send('Stream not found');
        }
    } catch (error) {
        res.status(500).send('Error');
    }
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
