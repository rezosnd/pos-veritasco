# Restaurant POS & QR Ordering System — Deployment Guide

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- MongoDB 6+ (local or MongoDB Atlas)
- npm or yarn

---

## 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secrets
npm install
npm run seed       # Seeds demo restaurant, menu, tables, staff
npm run dev        # Starts on http://localhost:5000
```

### Seed Credentials (after `npm run seed`)
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@restaurantpos.com | Admin@123456 |
| Restaurant Admin | restaurantadmin@spicegarden.com | Admin@123456 |
| Waiter | waiter@spicegarden.com | Waiter@123 |
| Kitchen | kitchen@spicegarden.com | Kitchen@123 |

---

## 2. Frontend Setup

```bash
cd frontend
cp .env.local.example .env.local
# Edit NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SOCKET_URL
npm install
npm run dev        # Starts on http://localhost:3000
```

---

## 3. Application URLs

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Landing page |
| http://localhost:3000/login | Staff login |
| http://localhost:3000/waiter | Waiter dashboard |
| http://localhost:3000/kitchen | Kitchen Display System |
| http://localhost:3000/admin | Restaurant admin |
| http://localhost:3000/superadmin | Super admin |
| http://localhost:3000/start?rid=RESTAURANT_ID&table=T1 | Customer QR entry |
| http://localhost:5000/health | Backend health check |
| http://localhost:5000/api | API info |

---

## 4. Customer QR Flow (for testing without phone)

1. Get the restaurant ID from seed output or super admin
2. Open: `http://localhost:3000/start?rid=<RESTAURANT_ID>&table=T1`
3. GPS validation will run (allow or skip in dev)
4. Waiter must activate Table T1 first from the waiter dashboard

---

## 5. Docker Compose (Recommended for Production)

```bash
# Create .env at root with your secrets
cp docker-compose.yml docker-compose.yml  # already exists
docker-compose up -d

# Seed data
docker exec pos_backend node scripts/seed.js
```

---

## 6. Production Deployment

### Backend → Railway / Render / EC2

```bash
# Set environment variables in your platform dashboard
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<64+ char secret>
JWT_REFRESH_SECRET=<64+ char secret>
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

### Frontend → Vercel

```bash
# Add env vars in Vercel dashboard:
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com
```

### PM2 (for EC2/VPS)

```bash
npm install -g pm2
pm2 start server.js --name "pos-backend" -i max
pm2 startup
pm2 save
```

---

## 7. MongoDB Atlas Setup

1. Create cluster (M10+ for production)
2. Add indexes (auto-created by Mongoose models):
   - `restaurants`: `slug`, `is_active`
   - `menus`: `restaurant_id + category`, text index
   - `tables`: `restaurant_id + table_number` (unique)
   - `sessions`: `table_id + status`, TTL on `expires_at`
   - `orders`: `restaurant_id + status`, `restaurant_id + order_number` (unique)
3. Enable IP Whitelist for your server IPs

---

## 8. Socket.IO Scaling (10,000+ concurrent users)

For horizontal scaling with multiple backend instances:

```bash
# Install Redis
npm install @socket.io/redis-adapter ioredis

# In backend/.env:
REDIS_URL=redis://your-redis-host:6379
```

The backend automatically uses Redis adapter when `REDIS_URL` is set (already implemented in `src/sockets/index.js` — uncomment the Redis adapter lines).

---

## 9. Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Use 64+ character JWT secrets
- [ ] Enable MongoDB authentication
- [ ] Set `ALLOWED_ORIGINS` to exact domain(s)
- [ ] Enable HTTPS (SSL/TLS) in production
- [ ] Set up Redis password
- [ ] Review rate limits in `src/middleware/rateLimiter.js`
- [ ] Enable MongoDB Atlas audit logging

---

## 10. QR Code Printing

After activating tables, download QR codes from Admin → Tables → Download QR.
Print on:
- A4 tent cards (place on tables)
- Sticker paper (stick on tables)
- 80mm thermal printer (use print button)

The QR URL format: `https://yourdomain.com/start?rid=RESTAURANT_ID&table=T1`
