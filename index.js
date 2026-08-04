const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://ophim1.com/'
};

// Hàm lấy dữ liệu và chuẩn hóa danh sách đúng 20 phim/trang
async function fetchMoviesCount(endpoint, page = 1, limit = 20) {
    // API gốc trả 10 item/page v1, ta tính toán số trang gốc cần gọi
    const startPage = ((page - 1) * limit / 10) + 1;
    const endPage = startPage + (limit / 10) - 1;
    
    let allItems = [];
    let cdnUrl = 'https://img.ophim.live/uploads/movies/';

    for (let p = startPage; p <= endPage; p++) {
        try {
            const url = `https://ophim1.com/v1/api/danh-sach/${endpoint}?page=${p}`;
            const response = await axios.get(url, { headers: HEADERS });
            const items = response.data?.data?.items || [];
            if (response.data?.data?.APP_DOMAIN_CDN_IMAGE) {
                cdnUrl = response.data.data.APP_DOMAIN_CDN_IMAGE;
            }
            allItems = allItems.concat(items);
        } catch (e) {
            console.error(`Lỗi tải trang ${p}:`, e.message);
        }
    }

    return allItems.slice(0, limit).map(item => ({
        title: item.name,
        origin_name: item.origin_name,
        slug: item.slug,
        poster: `${cdnUrl}${item.poster_url}`,
        movie_url: `https://ophim1.com/phim/${item.slug}`
    }));
}

// 1. API Phim Bộ (Hiển thị 20 bộ phim/trang)
app.get('/api/phim-bo', async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const movies = await fetchMoviesCount('phim-bo', page, 20);
        res.json({
            status: 'success',
            category: 'phim-bo',
            page: page,
            total: movies.length,
            data: movies
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 2. API Phim Lẻ (Hiển thị 20 bộ phim/trang)
app.get('/api/phim-le', async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const movies = await fetchMoviesCount('phim-le', page, 20);
        res.json({
            status: 'success',
            category: 'phim-le',
            page: page,
            total: movies.length,
            data: movies
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 3. API Tất cả phim mới (Hiển thị 20 phim/trang)
app.get('/api/movies', async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const movies = await fetchMoviesCount('phim-moi-cap-nhat', page, 20);
        res.json({
            status: 'success',
            category: 'phim-moi',
            page: page,
            total: movies.length,
            data: movies
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 4. Lấy link stream video m3u8
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
