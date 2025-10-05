# Building Scanner

This project is a minimal React + Express app that accepts a photo, extracts GPS EXIF from the image, and queries the OpenAI API to return information about the building at those coordinates.

Structure:
- `server/` - Express backend. POST /api/scan expects form field `photo`.
- `client/` - React frontend (Vite) with a file upload and preview.

Setup
1. Server
   - cd server
   - Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
   - npm install
   - npm run dev

2. Client
   - cd client
   - npm install
   - npm run dev

- Notes
- This prototype sends coordinates to the OpenAI Chat API and asks for a JSON object. Train/validate the prompt for your needs and consider adding caching and rate limiting for production.
- EXIF GPS data may be missing if the image had location stripped.

PowerShell quick start (Windows)

Open two PowerShell windows/tabs.

Server:
```powershell
cd .\server
copy .env.example .env
# edit .env and set OPENAI_API_KEY
npm install; npm run dev
```

Client:
```powershell
cd .\client
npm install; npm run dev
```

License: MIT
