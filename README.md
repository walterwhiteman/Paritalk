# Paritalk - Premium Chat Application

A beautiful, private chat application designed exclusively for Yash and Pari.

## Features

- **Private Room Access**: Only specific room codes are allowed (5201314pari, 238023)
- **Real-time Messaging**: Powered by Firebase Realtime Database
- **File Sharing**: Upload and share images/files via Supabase Storage
- **Video Calling**: Integrated Jitsi Meet for video calls
- **Emoji Reactions**: React to messages with emojis
- **Typing Indicators**: See when your partner is typing
- **User Presence**: Know when your partner is online/offline
- **PWA Support**: Install as a mobile app
- **Apple-style Design**: Clean, minimalist interface

## Setup Instructions

### 1. Firebase Configuration

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Realtime Database
3. Set up authentication (optional, for enhanced security)
4. Copy your Firebase configuration and update `src/config/firebase.ts`

### 2. Supabase Configuration

1. Create a new Supabase project at [Supabase](https://supabase.com)
2. Create a storage bucket named `paritalk-files`
3. Set up public access policies for the bucket
4. Copy your Supabase URL and anon key to `src/config/supabase.ts`

### 3. Development

```bash
npm install
npm run dev
```

### 4. Deployment

```bash
npm run build
# Deploy the `dist` folder to your hosting provider
```

## Room Codes

Only these room codes are allowed:
- `5201314pari`
- `238023`

## Technologies Used

- **Frontend**: React, TypeScript, Tailwind CSS
- **Database**: Firebase Realtime Database
- **Storage**: Supabase Storage
- **Video Calls**: Jitsi Meet
- **Icons**: Lucide React
- **Build Tool**: Vite

## Security Features

- Private room access with predefined codes
- Real-time presence tracking
- Secure file upload and sharing
- End-to-end encrypted video calls via Jitsi

## PWA Features

- Installable as a mobile app
- Offline support via service worker
- Native app-like experience