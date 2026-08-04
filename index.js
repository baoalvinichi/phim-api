const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://phimcn.site/'
};

// 1. Lấy danh sách phim mới cập nhật qua API
app.get('/api/movies', async (req, res) => {
    try {
        const response = await axios.get('https://ophim1.com/danh-sach/phim-moi-cap-nhat?page=1', { headers: HEADERS });
        const items = response.data.items || [];
        const pathImage = response.data.pathImage || '';

        const movies = items.map(item => ({
            title: item.name,
            origin_name: item.origin_name,
            slug: item.slug,
            poster: `${pathImage}${item.poster_url}`,
            movie_url: `https://ophim1.com/phim/${item.slug}`
        }));

        res.json({ status: 'success', total: movies.length, data: movies });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 2. Lấy link xem phim (.m3u8)
app.get('/api/get-stream', async (req, res) => {
    const slug = req.query.slug || req.query.url;
    if (!slug) return res.status(400).json({ error: 'Thiếu tham số slug/url' });

    try {
        const cleanSlug = slug.includes('/') ? slug.split('/').pop() : slug;
        const { data } = await axios.get(`https://ophim1.com/phim/${cleanSlug}`, { headers: HEADERS });
        
        const episodes = data.episodes || [];
        let streamUrl = '';

        if (episodes.length > 0 && episodes[0].server_data.length > 0) {
            streamUrl = episodes[0].server_data[0].link_m3u8;
        }

        if (streamUrl) {
            res.json({ status: 'success', stream_url: streamUrl });
        } else {
            res.status(404).json({ status: 'error', message: 'Không tìm thấy luồng m3u8' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

