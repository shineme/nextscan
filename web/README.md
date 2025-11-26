This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Worker Failover Configuration

This application supports distributed scanning using Cloudflare Workers with automatic failover and load balancing.

### Quick Setup

1. **Deploy Cloudflare Workers**
   - Deploy scanning workers to Cloudflare
   - See [WORKER_SETUP_GUIDE.md](./WORKER_SETUP_GUIDE.md) for detailed instructions

2. **Configure Worker URLs**
   - Navigate to Settings → Cloudflare Worker Configuration
   - Enable Worker Mode
   - Add your worker URLs (one per line)

3. **Adjust Parameters**
   - Batch Size: 10-50 (recommended)
   - Timeout: 10000-30000ms
   - Daily Quota: 100000 (Cloudflare free tier limit)

### Features

- ✅ **Load Balancing**: Round-robin distribution across multiple workers
- ✅ **Auto Failover**: Automatic fallback when workers fail
- ✅ **Health Monitoring**: Real-time worker health tracking
- ✅ **Quota Management**: Daily request quota per worker
- ✅ **Block Detection**: Automatic detection of blocked workers
- ✅ **Local Fallback**: Falls back to local scanning when all workers unavailable

### Documentation

- [Worker Setup Guide](./WORKER_SETUP_GUIDE.md) - Complete setup instructions
- [Troubleshooting Guide](./WORKER_TROUBLESHOOTING.md) - Common issues and solutions

### API Endpoints

- `GET /api/workers/status` - Get worker pool status
- `POST /api/workers/test` - Test worker endpoint
- `POST /api/workers/enable` - Re-enable disabled worker
- `POST /api/workers/reset` - Reset worker quota
- `POST /api/workers/reload` - Reload configuration

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
