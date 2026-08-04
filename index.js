const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://ophim1.com/'
};

// Hàm lấy thông tin chi tiết từng phim (tập phim, link stream m3u8)
async function getMovieDetail(slug) {
    try {
        const { data } = await axios.get(`https://ophim1.com/phim/${slug}`, { headers: HEADERS, timeout: 5000 });
        const item = data.movie || {};
        const episodes = data.episodes || [];
        
        let playUrl = '';
        if (episodes.length > 0 && episodes[0].server_data.length > 0) {
            const epList = episodes[0].server_data.map(ep => `${ep.name}$${ep.link_m3u8}`);
            playUrl = epList.join('#');
        }

        const cdnUrl = 'https://img.ophim.live/uploads/movies/';
        return {
            vod_id: item.slug || slug,
            vod_name: item.name || '',
            vod_pic: item.poster_url ? (item.poster_url.startsWith('http') ? item.poster_url : `${cdnUrl}${item.poster_url}`) : '',
            vod_remarks: item.episode_current || '',
            vod_actor: item.actor ? item.actor.join(', ') : '',
            vod_director: item.director ? item.director.join(', ') : '',
            vod_content: item.content ? item.content.replace(/<[^>]*>?/gm, '') : '',
            vod_play_from: 'OPhim',
            vod_play_url: playUrl
        };
    } catch (e) {
        return null;
    }
}

// Hàm cấu hình chung cho Monplayer
function getMonplayerConfig(baseUrl) {
    return {
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
    };
}

// 1. Trang chủ chính (đáp ứng link dạng https://phim-api.onrender.com hoặc https://phim-api.onrender.com/phim)
app.get(['/', '/phim'], (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    res.json(getMonplayerConfig(baseUrl));
});

// Giữ lại endpoint .json phụ phòng khi cần
app.get('/monplayer.json', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    res.json(getMonplayerConfig(baseUrl));
});

// 2. API xử lý dữ liệu danh sách & chi tiết phim chuẩn Monplayer
app.get('/api/cms', async (req, res) => {
    try {
        const type = req.query.type || 'phim-bo';
        const page = req.query.pg || 1;
        const ids = req.query.ids;

        // Nếu Monplayer gọi thông tin tập phim theo ID
        if (ids) {
            const slugList = ids.split(',');
            const details = await Promise.all(slugList.map(slug => getMovieDetail(slug)));
            const validDetails = details.filter(d => d !== null);

            return res.json({
                code: 1,
                msg: "ok",
                page: 1,
                pagecount: 1,
                limit: validDetails.length,
                total: validDetails.length,
                list: validDetails
            });
        }

        // Trả danh sách phim theo phân trang
        const url = `https://ophim1.com/v1/api/danh-sach/${type}?page=${page}`;
        const response = await axios.get(url, { headers: HEADERS, timeout: 8000 });
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
            pagecount: response.data?.data?.params?.pagination?.totalPages || 100,
            limit: movies.length,
            total: 2000,
            list: movies
        });
    } catch (error) {
        res.status(500).json({ code: 0, msg: error.message, list: [] });
    }
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
