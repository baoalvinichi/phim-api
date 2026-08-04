const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Giả lập Header trình duyệt để tránh bị chặn 403
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://phimcn.site/'
};

// 1. API Lấy danh sách phim mới / Tìm kiếm
app.get('/api/movies', async (req, res) => {
    try {
        const targetUrl = 'https://phimcn.site/'; // Hoặc URL trang danh mục/tìm kiếm
        const { data } = await axios.get(targetUrl, { headers: HEADERS });
        const $ = cheerio.load(data);
        
        const movies = [];
        // Lấy thông tin các thẻ chứa phim (Thay đổi selector theo cấu trúc HTML thực tế của trang)
        $('.list-films .item, .movie-item').each((index, element) => {
            const title = $(element).find('.title, .name').text().trim();
            const link = $(element).find('a').attr('href');
            const poster = $(element).find('img').attr('src') || $(element).find('img').attr('data-src');

            if (title && link) {
                movies.push({
                    title: title,
                    movie_url: link.startsWith('http') ? link : `https://phimcn.site${link}`,
                    poster: poster
                });
            }
        });

        res.json({ status: 'success', total: movies.length, data: movies });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 2. API Giải mã & Lấy link video (.m3u8 / mp4) của một tập phim
app.get('/api/get-stream', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ error: 'Thiếu tham số url' });

    try {
        const { data } = await axios.get(movieUrl, { headers: HEADERS });
        const $ = cheerio.load(data);

        // Trường hợp 1: Link m3u8 nằm trực tiếp trong thẻ <iframe src="...">
        let iframeSrc = $('iframe').attr('src');
        
        // Trường hợp 2: Link nằm trong đoạn mã JavaScript (Regex tìm file .m3u8)
        const m3u8Match = data.match(/(https?:\/\/[^"'s]+\.m3u8[^"'s]*)/i);
        let streamUrl = m3u8Match ? m3u8Match[0] : null;

        if (!streamUrl && iframeSrc) {
            // Nếu dùng iframe, tiếp tục crawl trang inside iframe
            if (!iframeSrc.startsWith('http')) iframeSrc = `https://phimcn.site${iframeSrc}`;
            const iframeRes = await axios.get(iframeSrc, { headers: HEADERS });
            const iframeMatch = iframeRes.data.match(/(https?:\/\/[^"'s]+\.m3u8[^"'s]*)/i);
            if (iframeMatch) streamUrl = iframeMatch[0];
        }

        if (streamUrl) {
            res.json({
                status: 'success',
                stream_url: streamUrl,
                headers_required: HEADERS // Một số luồng m3u8 yêu cầu gửi kèm Referer/User-Agent khi phát
            });
        } else {
            res.status(404).json({ status: 'error', message: 'Không tìm thấy luồng stream video' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.listen(PORT, () => console.log(`API Server đang chạy tại http://localhost:${PORT}`));