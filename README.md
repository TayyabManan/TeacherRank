# Teacher Rank - Student-Driven Teacher Rating Platform

![Teacher Rank](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-18.3-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-7.1-646cff)

## 🎓 Overview

Teacher Rank is a modern web application that empowers students to discover, rate, and review their teachers. Built with React and TypeScript, it provides an intuitive platform for students to share their educational experiences and help others make informed decisions about their academic journey.

**Live Demo:** [https://teacherrank.vercel.app](https://teacherrank.vercel.app)

## ✨ Features

### Core Functionality
- **📊 Teacher Rankings** - Browse teachers sorted by ratings, with visual ranking badges
- **⭐ Rating System** - 5-star rating mechanism with detailed reviews and comments
- **🔍 Advanced Search** - Filter by institute, department, or search by name
- **📱 Mobile-First Design** - Fully responsive with touch-friendly UI and haptic feedback
- **🔐 Secure Authentication** - Google OAuth integration with role-based access control
- **🎯 Real-time Updates** - Live data synchronization via Supabase

### Performance Optimizations
- **⚡ Code Splitting** - Lazy loading with automatic retry for failed chunks
- **🚀 Virtual Scrolling** - Efficiently handle large lists of teachers
- **💾 Smart Caching** - Aggressive caching strategies for optimal performance
- **📦 Bundle Optimization** - Gzip and Brotli compression for smaller downloads
- **🖼️ Image Optimization** - Lazy loading and responsive images

### User Experience
- **🌙 Dark Mode Support** - Theme switching for comfortable viewing
- **♿ Accessibility** - ARIA labels and keyboard navigation support
- **🔄 Pull-to-Refresh** - Mobile gesture support for content refresh
- **📈 Achievement System** - Visual badges for top-rated and popular teachers
- **🍞 Breadcrumb Navigation** - Clear navigation hierarchy

## 🛠️ Tech Stack

### Frontend
- **React 18.3** - Modern React with Hooks and Suspense
- **TypeScript 5.9** - Type-safe development
- **Vite 7.1** - Lightning-fast build tool
- **TailwindCSS 3.4** - Utility-first CSS framework
- **DaisyUI 3.9** - Component library for Tailwind
- **React Router 6.30** - Client-side routing
- **React Query 5.85** - Data fetching and caching
- **React Hook Form 7.62** - Form handling with validation
- **Zod 4.1** - Schema validation

### Backend & Services
- **Supabase** - PostgreSQL database with real-time subscriptions
- **Supabase Auth** - Authentication and authorization
- **Vercel** - Deployment and hosting
- **Sentry** - Error tracking and monitoring

### Development Tools
- **ESBuild** - Fast JavaScript bundler
- **PostCSS** - CSS processing
- **Autoprefixer** - Vendor prefix automation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase account

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/teacher-rank.git
cd teacher-rank
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ADMIN_EMAIL=your_admin_email@example.com
VITE_SENTRY_DSN=your_sentry_dsn (optional)
```

4. **Run development server**
```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) to see the app.

## 📜 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run type-check   # Run TypeScript type checking
npm run lint         # Run linting
npm run analyze      # Analyze bundle size
npm run generate:sitemap  # Generate sitemap with all teachers
```

## 🗄️ Database Schema

### Core Tables

- **profiles** - User metadata and roles
- **teachers** - Teacher information and details
- **ratings** - Student reviews and ratings
- **teacher_aggregates** - Computed rating statistics

### Setting up Database

1. Create a new Supabase project
2. Run the SQL scripts in `supabase/` folder in order
3. Set up Row Level Security (RLS) policies
4. Configure authentication providers

## 🏗️ Project Structure

```
teacher-rank/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route page components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and configurations
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Helper functions
│   └── styles/          # CSS and style files
├── public/              # Static assets
├── supabase/           # Database migrations and functions
├── api/                # Vercel serverless functions
└── scripts/            # Build and utility scripts
```

## 🚢 Deployment

### Deploy to Vercel

1. **Push to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Import to Vercel**
- Go to [Vercel Dashboard](https://vercel.com/dashboard)
- Click "New Project"
- Import your GitHub repository
- Configure environment variables
- Deploy

3. **Configure Domain (Optional)**
- Add custom domain in Vercel settings
- Update DNS records

## 🔍 SEO & Sitemap

The app includes SEO optimizations:
- Dynamic meta tags
- Structured data (Schema.org)
- XML sitemap generation
- Robots.txt configuration

To generate sitemap with all teachers:
```bash
npm run generate:sitemap
```

Submit sitemap to Google Search Console:
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://teacherrank.vercel.app`
3. Submit sitemap: `sitemap.xml`

## 🐛 Common Issues

### Platform-specific esbuild error
If you get esbuild platform errors when switching between Windows/WSL:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Dynamic import errors
Clear browser cache and reload if you see chunk loading errors after deployment.

### Authentication issues
Ensure your Supabase URL and anon key are correctly set in `.env`.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) for the backend infrastructure
- [Vercel](https://vercel.com) for hosting
- [DaisyUI](https://daisyui.com) for UI components
- All contributors and users of Teacher Rank

## 📞 Support

For support, email support@teacherrank.com or open an issue on GitHub.

---

Built with ❤️ by the Teacher Rank Team