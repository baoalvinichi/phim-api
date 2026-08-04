const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://ophim1.com/'
};

// Hàm lấy dữ liệu an toàn
async function fetchMovies(endpoint) {
    try {
        const url = `https://ophim1.com/v1/api/danh-sach/${endpoint}?page=1`;
        const response = await axios.get(url, { headers: HEADERS, timeout: 4000 });
        const items = response.data?.data?.items || [];
        const cdnUrl = response.data?.data?.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live/uploads/movies/';

        if (items.length > 0) {
            return items.slice(0, 20).map(item => ({
                title: item.name ? item.name.replace(/,/g, ' -') : 'Phim',
                slug: item.slug,
                poster: `${cdnUrl}${item.poster_url}`
            }));
        }
    } catch (e) {
        console.error(`Lỗi fetch ${endpoint}:`, e.message);
    }
    return [];
}

app.get('/', (req, res) => res.send('API OK'));

// Playlist M3U tối ưu riêng cho TiviMate
app.get(['/playlist.m3u', '/playlist.m3u8'], async (req, res) => {
    try {
        let phimBo = await fetchMovies('phim-bo');
        let phimLe = await fetchMovies('phim-le');

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        let m3u = '#EXTM3U\n';

        // Nhóm Phim Bộ
        if (phimBo.length > 0) {
            phimBo.forEach(movie => {
                m3u += `#EXTINF:-1 tvg-logo="${movie.poster}" group-title="PHIM BỘ", ${movie.title}\n`;
                m3u += `${baseUrl}/api/get-stream?slug=${movie.slug}\n`;
            });
        } else {
            m3u += `#EXTINF:-1 group-title="PHIM BỘ", Phim Bộ Mẫu\nhttps://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8\n`;
        }

        // Nhóm Phim Lẻ
        if (phimLe.length > 0) {
            phimLe.forEach(movie => {
                m3u += `#EXTINF:-1 tvg-logo="${movie.poster}" group-title="PHIM LẺ", ${movie.title}\n`;
                m3u += `${baseUrl}/api/get-stream?slug=${movie.slug}\n`;
            });
        } else {
            m3u += `#EXTINF:-1 group-title="PHIM LẺ", Phim Lẻ Mẫu\nhttps://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8\n`;
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.status(200).send(m3u);
    } catch (error) {
        res.status(200).send('#EXTM3U\n#EXTINF:-1 group-title="PHIM", Phim Mẫu\nhttps://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8\n');
    }
});

// Chuyển hướng luồng phát m3u8
app.get('/api/get-stream', async (req, res) => {
    const slug = req.query.slug || req.query.url;
    if (!slug) return res.redirect('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');

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
            res.redirect('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
        }
    } catch (error) {
        res.redirect('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
    }
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
