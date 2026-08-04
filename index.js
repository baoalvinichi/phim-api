const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://ophim1.com/'
};

// Hàm lấy danh sách phim
async function fetchMovies(endpoint, page = 1) {
    try {
        const url = `https://ophim1.com/v1/api/danh-sach/${endpoint}?page=${page}`;
        const response = await axios.get(url, { headers: HEADERS, timeout: 8000 });
        const items = response.data?.data?.items || [];
        const cdnUrl = response.data?.data?.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live/uploads/movies/';

        return items.map(item => ({
            vod_id: item.slug,
            vod_name: item.name,
            vod_pic: `${cdnUrl}${item.poster_url}`,
            vod_remarks: item.episode_current || ''
        }));
    } catch (e) {
        return [];
    }
}

// 1. Endpoint Cấu hình chuẩn Extension dành riêng cho Monplayer
app.get('/monplayer.json', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    res.json({
        sites: [
            {
                key: "phim_bo",
                name: "📺 PHIM BỘ",
                type: 3,
                api: `${baseUrl}/api/cms?type=phim-bo`,
                searchable: 1,
                quickSearch: 1,
                filterable: 1
            },
            {
                key: "phim_le",
                name: "🎬 PHIM LẺ",
                type: 3,
                api: `${baseUrl}/api/cms?type=phim-le`,
                searchable: 1,
                quickSearch: 1,
                filterable: 1
            }
        ]
    });
});

// 2. API Trả dữ liệu danh sách phim chuẩn CMS cho Monplayer
app.get('/api/cms', async (req, res) => {
    const type = req.query.type || 'phim-bo';
    const page = req.query.pg || 1;
    const movies = await fetchMovies(type, page);

    res.json({
        code: 1,
        msg: "phản hồi thành công",
        page: Number(page),
        pagecount: 100,
        limit: 20,
        total: 2000,
        list: movies
    });
});

// 3. API lấy link phát video m3u8
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
