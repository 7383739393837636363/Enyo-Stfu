let cheerio;
try {
    cheerio = require("cheerio");
} catch {
    cheerio = null;
}

const { createCanvas, loadImage, registerFont } = require("canvas");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const moment = require("moment-timezone");

const AVATAR_TOKEN = "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";
const IMAGE_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CONFIG = {
    canvasWidth: 1200,
    canvasHeight: 740,
    deltaNext: 5,
    cacheDir: path.join(__dirname, "cache"),
    avatarCache: new Map(),
    avatarCacheDuration: 10 * 60 * 1000,
    coverCache: new Map(),
    coverCacheDuration: 30 * 60 * 1000,
    fbToken: AVATAR_TOKEN,
    facebookTokens: [AVATAR_TOKEN],
    defaultAvatar: null,
};

const emojiCache = new Map();

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function expToLevel(exp) {
    return Math.floor((1 + Math.sqrt(1 + (8 * (exp || 0)) / CONFIG.deltaNext)) / 2);
}

function levelToExp(level) {
    return Math.floor(((level ** 2 - level) * CONFIG.deltaNext) / 2);
}

function formatNumber(num) {
    if (!num || isNaN(num) || !Number.isFinite(num)) return "0";
    const abs = Math.abs(num);
    const sign = num < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
    return `${sign}${Math.round(abs)}`;
}

async function loadImageSafe(url) {
    if (!url) throw new Error("Empty image URL");
    try {
        return await loadImage(url);
    } catch (err) {
        const res = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 15000,
            maxRedirects: 5,
            headers: { "User-Agent": IMAGE_USER_AGENT },
        });
        const contentType = String(res.headers?.["content-type"] || "");
        if (!contentType.startsWith("image/")) throw err;
        return await loadImage(Buffer.from(res.data));
    }
}

async function drawEmoji(ctx, emoji, x, y, size = 24) {
    if (!emoji) return;
    try {
        const points = [];
        for (const ch of emoji) {
            const code = ch.codePointAt(0);
            if (code !== 0xfe0f) points.push(code.toString(16).toLowerCase());
        }
        const hex = points.join("-");
        if (!hex) {
            ctx.font = `${size}px sans-serif`;
            ctx.fillText(emoji, x, y);
            return;
        }

        if (!emojiCache.has(hex)) {
            const twemojiUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${hex}.png`;
            try {
                const img = await loadImageSafe(twemojiUrl);
                emojiCache.set(hex, img);
            } catch {
                emojiCache.set(hex, null);
            }
        }

        const img = emojiCache.get(hex);
        if (img) {
            ctx.drawImage(img, x, y - size + 4, size, size);
        } else {
            ctx.font = `${size}px sans-serif`;
            ctx.fillText(emoji, x, y);
        }
    } catch {
        ctx.font = `${size}px sans-serif`;
        ctx.fillText(emoji, x, y);
    }
}

// 10 Themes with Dynamic Fallback Banners
const THEMES = [
    {
        id: "cyberpunk",
        name: "Cyber Void",
        primary: "#00F0FF",
        secondary: "#FF0055",
        accent: "#FFE600",
        bg: ["#050814", "#0C1026", "#140A26"],
        cardBg: "rgba(12, 16, 38, 0.92)",
        bannerFallback: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1200&auto=format&fit=crop"
    },
    {
        id: "aurora",
        name: "Aurora Borealis",
        primary: "#7F00FF",
        secondary: "#00FFB2",
        accent: "#FF3399",
        bg: ["#070B19", "#111836", "#1C143B"],
        cardBg: "rgba(17, 24, 54, 0.92)",
        bannerFallback: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?q=80&w=1200&auto=format&fit=crop"
    },
    {
        id: "crimson",
        name: "Crimson Eclipse",
        primary: "#FF2A2A",
        secondary: "#FF7300",
        accent: "#FFAA00",
        bg: ["#140202", "#2B0909", "#3D0C0C"],
        cardBg: "rgba(43, 9, 9, 0.92)",
        bannerFallback: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop"
    },
    {
        id: "emerald",
        name: "Emerald Matrix",
        primary: "#00FF88",
        secondary: "#00D68F",
        accent: "#70FF00",
        bg: ["#02140A", "#062B16", "#0B3D21"],
        cardBg: "rgba(6, 43, 22, 0.92)",
        bannerFallback: "https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?q=80&w=1200&auto=format&fit=crop"
    },
    {
        id: "royal_gold",
        name: "Royal Monarch",
        primary: "#FFD700",
        secondary: "#FF9100",
        accent: "#FFF275",
        bg: ["#140E02", "#2E1F03", "#3D2B06"],
        cardBg: "rgba(46, 31, 3, 0.92)",
        bannerFallback: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=1200&auto=format&fit=crop"
    },
    {
        id: "ocean_abyss",
        name: "Ocean Abyss",
        primary: "#00B4DB",
        secondary: "#0083B0",
        accent: "#00FFE0",
        bg: ["#020B14", "#06182B", "#0A243D"],
        cardBg: "rgba(6, 24, 43, 0.92)",
        bannerFallback: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1200&auto=format&fit=crop"
    },
    {
        id: "sakura",
        name: "Sakura Bloom",
        primary: "#FF7597",
        secondary: "#FFB3C6",
        accent: "#D68CFF",
        bg: ["#1C0812", "#331223", "#4A1B34"],
        cardBg: "rgba(51, 18, 35, 0.92)",
        bannerFallback: "https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=1200&auto=format&fit=crop"
    },
    {
        id: "galaxy",
        name: "Galaxy Nebula",
        primary: "#9D4EDD",
        secondary: "#FF54B0",
        accent: "#54B5FF",
        bg: ["#080314", "#15082E", "#220D47"],
        cardBg: "rgba(21, 8, 46, 0.92)",
        bannerFallback: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop"
    },
    {
        id: "sunset",
        name: "Sunset Synth",
        primary: "#FF4E50",
        secondary: "#F9D423",
        accent: "#FC913A",
        bg: ["#170707", "#2E0E0E", "#421818"],
        cardBg: "rgba(46, 14, 14, 0.92)",
        bannerFallback: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop"
    },
    {
        id: "obsidian",
        name: "Obsidian Dark",
        primary: "#E0E0E0",
        secondary: "#888888",
        accent: "#FFFFFF",
        bg: ["#0A0A0A", "#141414", "#1E1E1E"],
        cardBg: "rgba(20, 20, 20, 0.94)",
        bannerFallback: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1200&auto=format&fit=crop"
    }
];

class AvatarService {
    static async getAvatar(userId, customAvatarUrl) {
        const cacheKey = `${userId}`;
        const cached = CONFIG.avatarCache.get(cacheKey);
        if (cached && Date.now() - cached.time < CONFIG.avatarCacheDuration) {
            return cached.image;
        }

        const candidateUrls = [
            `https://graph.facebook.com/${userId}/picture?width=1000&height=1000&access_token=${AVATAR_TOKEN}`,
            customAvatarUrl,
            `https://graph.facebook.com/${userId}/picture?type=large`
        ].filter(Boolean);

        for (const url of candidateUrls) {
            try {
                const img = await loadImageSafe(url);
                CONFIG.avatarCache.set(cacheKey, { image: img, time: Date.now() });
                return img;
            } catch {}
        }
        return null;
    }
}

// 🎨 Facebook Profile Header Style Rank Card
class ProfileCoverRankCard {
    constructor(data) {
        this.data = data;
        this.theme = THEMES[data.themeIndex] || THEMES[0];
        this.canvas = createCanvas(CONFIG.canvasWidth, CONFIG.canvasHeight);
        this.ctx = this.canvas.getContext("2d");
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = "high";
    }

    roundRect(x, y, w, h, r) {
        if (typeof r === "number") {
            r = { tl: r, tr: r, br: r, bl: r };
        }
        this.ctx.beginPath();
        this.ctx.moveTo(x + r.tl, y);
        this.ctx.lineTo(x + w - r.tr, y);
        this.ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr);
        this.ctx.lineTo(x + w, y + h - r.br);
        this.ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
        this.ctx.lineTo(x + r.bl, y + h);
        this.ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl);
        this.ctx.lineTo(x, y + r.tl);
        this.ctx.arcTo(x, y, x + r.tl, y, r.tl);
        this.ctx.closePath();
    }

    async render() {
        // Outer dark background
        const grad = this.ctx.createRadialGradient(
            CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2, 50,
            CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2, CONFIG.canvasWidth
        );
        grad.addColorStop(0, this.theme.bg[0]);
        grad.addColorStop(1, this.theme.bg[2]);
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

        // Draw Card Base
        const cx = 35, cy = 30, cw = CONFIG.canvasWidth - 70, ch = CONFIG.canvasHeight - 60;
        this.ctx.save();
        this.ctx.shadowColor = this.theme.primary;
        this.ctx.shadowBlur = 25;
        this.ctx.fillStyle = this.theme.cardBg;
        this.roundRect(cx, cy, cw, ch, 28);
        this.ctx.fill();
        this.ctx.strokeStyle = `${this.theme.primary}66`;
        this.ctx.lineWidth = 2;
        this.roundRect(cx, cy, cw, ch, 28);
        this.ctx.stroke();
        this.ctx.restore();

        // 1. Draw Hero Facebook Cover Banner (Top 40%)
        await this.drawCoverBanner(cx, cy, cw, 250);

        // 2. Draw Overlapping Profile Avatar
        await this.drawAvatar(cx + 120, cy + 250);

        // 3. Draw Profile Name & Tags
        await this.drawProfileHeader(cx + 225, cy + 265);

        // 4. Draw EXP Progress Bar
        this.drawExpBar(cx + 40, cy + 360, cw - 80, 36);

        // 5. Draw 4 Interactive Stats Cards
        await this.drawStatsCards(cx + 40, cy + 425, cw - 80);

        // 6. Draw Footer
        this.drawFooter(cx, cy, cw, ch);

        return this.canvas.toBuffer("image/png");
    }

    async drawCoverBanner(x, y, w, h) {
        this.ctx.save();
        this.roundRect(x, y, w, h, { tl: 28, tr: 28, bl: 0, br: 0 });
        this.ctx.clip();

        let coverImg = null;
        if (this.data.coverUrl) {
            try {
                coverImg = await loadImageSafe(this.data.coverUrl);
            } catch {}
        }
        if (!coverImg) {
            try {
                coverImg = await loadImageSafe(this.theme.bannerFallback);
            } catch {}
        }

        if (coverImg) {
            this.ctx.drawImage(coverImg, x, y, w, h);
        } else {
            const bannerGrad = this.ctx.createLinearGradient(x, y, x + w, y + h);
            bannerGrad.addColorStop(0, this.theme.primary);
            bannerGrad.addColorStop(1, this.theme.secondary);
            this.ctx.fillStyle = bannerGrad;
            this.ctx.fillRect(x, y, w, h);
        }

        // Gradient fade to blend cover with bottom profile card
        const fadeGrad = this.ctx.createLinearGradient(x, y + h - 110, x, y + h);
        fadeGrad.addColorStop(0, "rgba(0, 0, 0, 0.0)");
        fadeGrad.addColorStop(1, this.theme.cardBg);
        this.ctx.fillStyle = fadeGrad;
        this.ctx.fillRect(x, y + h - 110, w, 110);

        // Facebook Cover Label Tag
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        this.roundRect(x + w - 160, y + 20, 140, 32, 16);
        this.ctx.fill();
        this.ctx.fillStyle = "#FFFFFF";
        this.ctx.font = "bold 13px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.fillText("📷 FB COVER", x + w - 90, y + 41);

        this.ctx.restore();
    }

    async drawAvatar(ax, ay) {
        const radius = 75;
        const avatar = await AvatarService.getAvatar(this.data.uid, this.data.avatarUrl);

        this.ctx.save();
        // Outer glowing border
        this.ctx.shadowColor = this.theme.primary;
        this.ctx.shadowBlur = 20;
        this.ctx.strokeStyle = this.theme.primary;
        this.ctx.lineWidth = 5;
        this.ctx.beginPath();
        this.ctx.arc(ax, ay, radius + 3, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();

        // Inner clip
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(ax, ay, radius, 0, Math.PI * 2);
        this.ctx.clip();

        if (avatar) {
            this.ctx.drawImage(avatar, ax - radius, ay - radius, radius * 2, radius * 2);
        } else {
            this.ctx.fillStyle = this.theme.secondary;
            this.ctx.fillRect(ax - radius, ay - radius, radius * 2, radius * 2);
            this.ctx.fillStyle = "#FFFFFF";
            this.ctx.font = "bold 60px sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText((this.data.name || "U")[0].toUpperCase(), ax, ay);
        }
        this.ctx.restore();

        // Online Status indicator badge
        this.ctx.save();
        this.ctx.fillStyle = "#00FF66";
        this.ctx.beginPath();
        this.ctx.arc(ax + radius - 15, ay + radius - 15, 14, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = this.theme.cardBg;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        this.ctx.restore();
    }

    async drawProfileHeader(px, py) {
        const name = this.data.name.length > 20 ? this.data.name.substring(0, 18) + "..." : this.data.name;

        // User Display Name
        this.ctx.save();
        this.ctx.font = "bold 38px sans-serif";
        this.ctx.fillStyle = "#FFFFFF";
        this.ctx.textAlign = "left";
        this.ctx.fillText(name, px, py);
        this.ctx.restore();

        // Subtitle Info & Badges
        this.ctx.font = "16px sans-serif";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        this.ctx.fillText(`ID: ${this.data.uid}  •  @${this.data.username}`, px, py + 30);

        // Rank Tier Pill
        let tier = "BRONZE";
        let tierColor = "#CD7F32";
        if (this.data.level >= 100) { tier = "ELITE"; tierColor = "#FF007F"; }
        else if (this.data.level >= 50) { tier = "MASTER"; tierColor = "#9D4EDD"; }
        else if (this.data.level >= 30) { tier = "DIAMOND"; tierColor = "#00F0FF"; }
        else if (this.data.level >= 15) { tier = "GOLD"; tierColor = "#FFD700"; }
        else if (this.data.level >= 5) { tier = "SILVER"; tierColor = "#C0C0C0"; }

        const badgeX = CONFIG.canvasWidth - 280;
        this.ctx.save();
        this.ctx.fillStyle = tierColor;
        this.roundRect(badgeX, py - 30, 190, 42, 21);
        this.ctx.fill();

        this.ctx.fillStyle = "#000000";
        this.ctx.font = "bold 16px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.fillText(`★ ${tier} • LVL ${this.data.level}`, badgeX + 95, py - 4);
        this.ctx.restore();

        // Server Rank tag
        this.ctx.save();
        this.ctx.textAlign = "center";
        this.ctx.font = "bold 18px sans-serif";
        this.ctx.fillStyle = this.theme.primary;
        this.ctx.fillText(`GLOBAL RANK #${this.data.expRank}`, badgeX + 95, py + 32);
        this.ctx.restore();
    }

    drawExpBar(x, y, w, h) {
        const r = h / 2;
        const progress = Math.min(Math.max(this.data.exp / this.data.neededExp, 0), 1);
        const fillW = Math.max(w * progress, 20);

        // Bar Track
        this.ctx.save();
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        this.roundRect(x, y, w, h, r);
        this.ctx.fill();
        this.ctx.restore();

        // Bar Fill
        this.ctx.save();
        const barGrad = this.ctx.createLinearGradient(x, 0, x + fillW, 0);
        barGrad.addColorStop(0, this.theme.primary);
        barGrad.addColorStop(1, this.theme.secondary);
        this.ctx.fillStyle = barGrad;
        this.ctx.shadowColor = this.theme.primary;
        this.ctx.shadowBlur = 12;
        this.roundRect(x, y, fillW, h, r);
        this.ctx.fill();
        this.ctx.restore();

        // Inside Bar Stats
        this.ctx.save();
        this.ctx.font = "bold 15px sans-serif";
        this.ctx.fillStyle = "#FFFFFF";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`PROGRESS: ${(progress * 100).toFixed(1)}%`, x + 20, y + 23);

        this.ctx.textAlign = "right";
        this.ctx.fillText(
            `${formatNumber(this.data.exp)} / ${formatNumber(this.data.neededExp)} EXP`,
            x + w - 20,
            y + 23
        );
        this.ctx.restore();
    }

    async drawStatsCards(x, y, totalW) {
        const topPct = (
            ((this.data.totalUsers - this.data.expRank + 1) / (this.data.totalUsers || 1)) * 100
        ).toFixed(1);

        const stats = [
            { icon: "💰", title: "Balance", value: formatNumber(this.data.money), color: this.theme.primary },
            { icon: "💬", title: "Messages", value: formatNumber(this.data.totalMessages), color: this.theme.secondary },
            { icon: "⚡", title: "Total EXP", value: formatNumber(this.data.totalExp), color: this.theme.accent },
            { icon: "🏆", title: "Percentile", value: `Top ${topPct}%`, color: "#00FF88" }
        ];

        const gap = 18;
        const cardW = (totalW - gap * 3) / 4;
        const cardH = 120;

        for (let i = 0; i < stats.length; i++) {
            const st = stats[i];
            const cx = x + i * (cardW + gap);

            this.ctx.save();
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
            this.roundRect(cx, y, cardW, cardH, 20);
            this.ctx.fill();

            this.ctx.strokeStyle = `${st.color}55`;
            this.ctx.lineWidth = 1.5;
            this.roundRect(cx, y, cardW, cardH, 20);
            this.ctx.stroke();
            this.ctx.restore();

            await drawEmoji(this.ctx, st.icon, cx + 20, y + 48, 30);

            this.ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
            this.ctx.font = "14px sans-serif";
            this.ctx.fillText(st.title, cx + 65, y + 36);

            this.ctx.fillStyle = "#FFFFFF";
            this.ctx.font = "bold 24px sans-serif";
            this.ctx.fillText(st.value, cx + 65, y + 74);
        }
    }

    drawFooter(x, y, w, h) {
        const fy = y + h - 22;
        const timeNow = moment().tz("Asia/Dhaka").format("DD MMM YYYY • hh:mm A");

        this.ctx.save();
        this.ctx.font = "13px sans-serif";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`© Siam Ahmed Saan`, x + 40, fy);

        this.ctx.textAlign = "right";
        this.ctx.fillText(`Dhaka: ${timeNow}`, x + w - 40, fy);
        this.ctx.restore();
    }
}

module.exports = {
    config: {
        name: "rank",
        version: "15.1",
        author: "Siam Ahmed Saan",
        countDown: 5,
        role: 0,
        description: {
            en: "Generates Facebook Profile-style Rank Cards with HD Avatar, Cover Banner and Stats",
        },
        category: "game",
        guide: {
            en: `🎯 RANK COMMAND GUIDE 🎯

Card Views:
• {pn} - View your rank card (with FB Cover Banner!)
• {pn} @mention - View mentioned user's rank
• {pn} [user_id] - View specific user's rank
• {pn} [1-10] - Apply a specific theme (1-10)`,
        },
    },

    getCookie: function () {
        const filePath = path.join(process.cwd(), "account.txt");
        if (!fs.existsSync(filePath)) return null;
        try {
            const raw = fs.readFileSync(filePath, "utf8");
            const data = JSON.parse(raw);
            const cookie = Array.isArray(data)
                ? data.map((c) => `${c.key || c.name}=${c.value}`).join("; ")
                : String(data);
            return {
                Authority: "www.facebook.com",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "max-age=0",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1",
                "User-Agent": IMAGE_USER_AGENT,
                Cookie: cookie,
            };
        } catch {
            return null;
        }
    },

    getUIDFromLink: async function (url) {
        try {
            if (!url) return null;
            if (url.includes("profile.php?id=")) {
                return url.split("id=")[1].split("&")[0];
            }
            const headers = this.getCookie();
            if (!headers) return null;
            const res = await axios.get(url, { headers, timeout: 10000 });
            const matches =
                res.data.match(/"userID":"(\d+)"/) ||
                res.data.match(/"user_id":"(\d+)"/) ||
                res.data.match(/"target_id":"(\d+)"/);
            return matches ? matches[1] : null;
        } catch {
            return null;
        }
    },

    getImg: async function (uid) {
        if (!uid) return null;

        const cached = CONFIG.coverCache.get(uid);
        if (cached && Date.now() - cached.time < CONFIG.coverCacheDuration) {
            return cached.url;
        }

        try {
            const headers = this.getCookie();
            if (!headers) return null;
            const url = `https://www.facebook.com/profile.php?id=${uid}`;
            const res = await axios.get(url, { headers, timeout: 15000 });
            const html = typeof res.data === "string" ? res.data : "";
            if (!html) return null;

            let coverUrl = null;
            const coverPatterns = [
                /"cover_photo":\s*\{\s*"image":\s*\{\s*"uri":\s*"([^"]+)"/i,
                /"coverPhoto":\s*\{\s*"photo":\s*\{\s*"image":\s*\{\s*"uri":\s*"([^"]+)"/i,
                /"profile_cover_photo":\s*\{\s*"image":\s*\{\s*"uri":\s*"([^"]+)"/i,
            ];
            for (const pattern of coverPatterns) {
                const match = pattern.exec(html);
                if (match && match[1]) {
                    coverUrl = match[1].replace(/\\/g, "").replace(/&amp;/g, "&");
                    break;
                }
            }

            if (!coverUrl && cheerio) {
                const $ = cheerio.load(html);
                const box = $(
                    "#profile_cover_photo_container, [data-imgperflogname='profileCoverPhoto']"
                );
                if (box.length) {
                    const img = box.is("img") ? box : box.find("img");
                    if (img.length && img.attr("src")) coverUrl = img.attr("src");
                }
            }

            if (!coverUrl) {
                const r2 = /"(https:\\\/\\\/scontent[^"]+\.fbcdn\.net[^"]+)"/g;
                let m2;
                const found = [];
                while ((m2 = r2.exec(html)) !== null) {
                    let cleanUrl = m2[1].replace(/\\/g, "").replace(/&amp;/g, "&");
                    found.push(cleanUrl);
                }
                const filtered = found.filter(
                    (u) =>
                        !u.includes("s160x160") &&
                        !u.includes("s40x40") &&
                        !u.includes("p160x160") &&
                        !u.includes("cp0_dst-jpg")
                );
                const bestMatch = filtered.find(
                    (u) =>
                        u.includes("cc71e4") ||
                        u.includes("720x720") ||
                        u.includes("1080x1080")
                );
                coverUrl = bestMatch || filtered[0] || found[0] || null;
            }

            if (coverUrl) {
                CONFIG.coverCache.set(uid, { url: coverUrl, time: Date.now() });
            }
            return coverUrl;
        } catch {
            return null;
        }
    },

    onStart: async function ({ message, event, usersData, threadsData, api, args }) {
        let tempFilePath = null;
        try {
            const { senderID, threadID, mentions, messageReply } = event;
            const sub = args[0]?.toLowerCase();

            if (sub === "help" || sub === "guide") {
                return message.reply(this.config.guide.en);
            }

            if (sub === "themes" || sub === "list") {
                let msg = "🎨 AVAILABLE THEMES 🎨\n\n";
                THEMES.forEach((t, i) => {
                    msg += `${i + 1}. ${t.name}\n`;
                });
                msg += "\n💡 Tip: Use `rank <1-10>` to view your card with that theme!";
                return message.reply(msg);
            }

            // Direct Cover Viewer
            if (sub === "cover" || sub === "fbcover") {
                try {
                    let uid = senderID;
                    if (messageReply?.senderID) {
                        uid = messageReply.senderID;
                    } else if (Object.keys(mentions || {}).length > 0) {
                        uid = Object.keys(mentions)[0];
                    } else if (args[1]) {
                        if (args[1].startsWith("http")) {
                            const extracted = await this.getUIDFromLink(args[1]);
                            if (extracted) uid = extracted;
                        } else if (!isNaN(args[1])) {
                            uid = args[1];
                        }
                    }

                    const link = await this.getImg(uid);
                    if (!link) {
                        return message.reply(`❌ Could not fetch cover photo for ID: ${uid}. Verify account.txt has active cookies.`);
                    }

                    let stream;
                    if (global.utils && typeof global.utils.getStreamFromURL === "function") {
                        stream = await global.utils.getStreamFromURL(link);
                    } else {
                        const res = await axios.get(link, { responseType: "stream" });
                        stream = res.data;
                    }

                    return await message.reply({
                        body: `Here's the cover photo for ID: ${uid}`,
                        attachment: stream,
                    });
                } catch {
                    return message.reply("An error occurred while fetching user info.");
                }
            }

            // Set Current Cover as Permanent Rank Background
            if (sub === "setcover") {
                const link = await this.getImg(senderID);
                if (!link) {
                    return message.reply("❌ Could not retrieve your Facebook cover photo. Please make sure account.txt is valid.");
                }
                const uData = (await usersData.get(senderID)) || {};
                uData.rankBackground = link;
                await usersData.set(senderID, uData);
                return message.reply("✅ Your Facebook cover photo has been saved as your rank card banner!");
            }

            // Custom Background Handlers
            if (sub === "setbg" || sub === "background") {
                const attachment = messageReply?.attachments?.[0];
                if (!attachment || attachment.type !== "photo") {
                    return message.reply("❌ Please reply to an image to set as your custom background!");
                }
                const uData = (await usersData.get(senderID)) || {};
                uData.rankBackground = attachment.url;
                await usersData.set(senderID, uData);
                return message.reply("✅ Custom rank background saved successfully!");
            }

            if (sub === "removebg" || sub === "deletebg") {
                const uData = (await usersData.get(senderID)) || {};
                if (uData.rankBackground) {
                    delete uData.rankBackground;
                    await usersData.set(senderID, uData);
                    return message.reply("✅ Custom rank background removed!");
                }
                return message.reply("ℹ️ You don't have a custom background set.");
            }

            let targetID = senderID;
            let themeIndex = Math.floor(Math.random() * THEMES.length);

            for (let i = 0; i < args.length; i++) {
                const num = parseInt(args[i]);
                if (!isNaN(num) && num >= 1 && num <= THEMES.length) {
                    themeIndex = num - 1;
                    break;
                }
            }

            if (messageReply?.senderID) {
                targetID = messageReply.senderID;
            } else if (Object.keys(mentions || {}).length > 0) {
                targetID = Object.keys(mentions)[0];
            } else if (args[0] && !isNaN(args[0]) && args[0].length > 5) {
                targetID = args[0];
            }

            const [targetUser, threadData, allUsers] = await Promise.all([
                usersData.get(targetID).catch(() => null),
                threadsData.get(threadID).catch(() => ({})),
                usersData.getAll().catch(() => []),
            ]);

            if (!targetUser) {
                return message.reply("❌ User data not found in the database!");
            }

            let fbInfo = {};
            try {
                const info = await api.getUserInfo(targetID);
                fbInfo = info[targetID] || {};
            } catch {
                fbInfo = { name: targetUser.name || `User_${targetID}` };
            }

            const sortedExp = [...allUsers]
                .filter((u) => u && u.exp > 0)
                .sort((a, b) => (b.exp || 0) - (a.exp || 0));
            const expRank = sortedExp.findIndex((u) => u.userID === targetID) + 1 || allUsers.length;

            const sortedMoney = [...allUsers]
                .filter((u) => u && u.money > 0)
                .sort((a, b) => (b.money || 0) - (a.money || 0));
            const moneyRank = sortedMoney.findIndex((u) => u.userID === targetID) + 1 || allUsers.length;

            const exp = targetUser.exp || 0;
            const level = expToLevel(exp);
            const curLvlExp = levelToExp(level);
            const nextLvlExp = levelToExp(level + 1);
            const progressExp = Math.max(0, exp - curLvlExp);
            const neededExp = Math.max(1, nextLvlExp - curLvlExp);

            const threadMembers = threadData?.members || [];
            const memberObj = threadMembers.find((m) => m && m.userID === targetID) || {};

            let coverUrl = targetUser.rankBackground;
            if (!coverUrl) {
                coverUrl = await this.getImg(targetID);
            }

            const renderData = {
                uid: targetID,
                name: fbInfo.name || targetUser.name || "Member",
                username: fbInfo.vanity || targetID,
                level: level,
                exp: progressExp,
                neededExp: neededExp,
                totalExp: exp,
                money: targetUser.money || 0,
                totalMessages: memberObj.count || 0,
                expPerDay: Math.round(exp / 30) || 0,
                expRank: expRank,
                moneyRank: moneyRank,
                totalUsers: allUsers.length || 1,
                coverUrl: coverUrl,
                avatarUrl: fbInfo.thumbSrc || null,
                themeIndex: themeIndex,
            };

            const card = new ProfileCoverRankCard(renderData);
            const buffer = await card.render();

            ensureDir(CONFIG.cacheDir);
            tempFilePath = path.join(CONFIG.cacheDir, `rank_${targetID}_${Date.now()}.png`);
            fs.writeFileSync(tempFilePath, buffer);

            const stream = fs.createReadStream(tempFilePath);
            stream.on("close", () => {
                try {
                    if (tempFilePath && fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                } catch {}
            });

            return await message.reply({
                body:
                    `🏆 [ PROFILE RANK • ${renderData.name} ]\n` +
                    `🎖️ Global Rank: #${expRank} of ${renderData.totalUsers}\n` +
                    `⭐ Level: ${level} | EXP: ${formatNumber(exp)}\n` +
                    `🎨 Theme: ${THEMES[themeIndex].name}`,
                attachment: stream,
            });
        } catch (error) {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch {}
            }
            console.error("Rank Command Error:", error);
            return message.reply(`❌ Failed to generate rank card: ${error.message}`);
        }
    },

    onChat: async function ({ event, usersData, threadsData }) {
        if (!event.isGroup || event.senderID === global.GoatBot?.botID) return;
        const { senderID, threadID } = event;

        try {
            const user = (await usersData.get(senderID)) || {};
            const expGain = Math.floor(Math.random() * 4) + 2;
            const moneyGain = Math.random() < 0.1 ? Math.floor(Math.random() * 10) + 1 : 0;

            await usersData.set(senderID, {
                exp: (user.exp || 0) + expGain,
                money: (user.money || 0) + moneyGain,
                lastActive: Date.now(),
            });

            const thread = (await threadsData.get(threadID)) || {};
            if (!Array.isArray(thread.members)) thread.members = [];

            const idx = thread.members.findIndex((m) => m && m.userID === senderID);
            if (idx >= 0) {
                thread.members[idx].count = (thread.members[idx].count || 0) + 1;
                thread.members[idx].lastMessage = Date.now();
            } else {
                thread.members.push({
                    userID: senderID,
                    count: 1,
                    lastMessage: Date.now(),
                });
            }
            await threadsData.set(threadID, { members: thread.members });
        } catch (err) {
            console.error("[Rank onChat Error]:", err.message);
        }
    },
};
