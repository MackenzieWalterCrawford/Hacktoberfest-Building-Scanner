# 🏢 Building Scanner

A full-stack web application that analyzes building photos using GPS EXIF data and AI. Upload an image with location metadata, and the app will extract the coordinates and provide detailed information about the building at that location using OpenAI's API.

**🌐 Live Demo:** https://hacktoberfest-building-scanner-frontend.onrender.com/

## ✨ Features

- 📸 Image upload with drag-and-drop support
- 🗺️ Automatic GPS EXIF data extraction from photos
- 🤖 AI-powered building analysis using OpenAI
- ⚡ Fast and responsive React frontend
- 🔒 Secure Express backend API

## 🏗️ Project Structure

```
├── server/          # Express backend API
│   ├── server.js    # Main server file with /api/scan endpoint
│   └── .env         # Environment variables (OPENAI_API_KEY)
└── client/          # React frontend (Vite)
    └── src/         # React components and assets
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Installation

#### 1. Server Setup

```bash
cd server
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
npm install
npm run dev
```

The server will start on `http://localhost:3001`

#### 2. Client Setup

```bash
cd client
npm install
npm run dev
```

The client will start on `http://localhost:5173`

### Windows PowerShell Quick Start

Open two PowerShell terminals:

**Terminal 1 - Server:**
```powershell
cd .\server
copy .env.example .env
# Edit .env and set OPENAI_API_KEY
npm install; npm run dev
```

**Terminal 2 - Client:**
```powershell
cd .\client
npm install; npm run dev
```

## 📡 API Endpoints

### `POST /api/scan`

Accepts a photo with GPS EXIF data and returns building information.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form field `photo` with image file

**Response:**
```json
{
  "coordinates": { "lat": 40.7128, "lon": -74.0060 },
  "buildingInfo": { ... }
}
```

## ⚠️ Important Notes

- **EXIF Data Required:** Images must contain GPS EXIF metadata. Photos that have had location data stripped will not work.
- **Production Considerations:** This is a prototype. For production use, consider implementing:
  - Rate limiting
  - Response caching
  - Input validation and sanitization
  - Error handling and logging
  - API key rotation and security measures

## 🛠️ Technologies Used

- **Frontend:** React, Vite
- **Backend:** Express.js, Node.js
- **AI:** OpenAI API
- **Image Processing:** EXIF data extraction

## 📝 License

MIT

---

Built for Hacktoberfest 🎃
