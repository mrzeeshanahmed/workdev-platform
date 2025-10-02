# Interview System - Quick Start Guide

## Setup Instructions

### 1. Install Dependencies

Run the following command to install all required packages:

```bash
npm install
```

This will install:

- `twilio-video` - Video calling SDK
- `@monaco-editor/react` - Code editor component
- `monaco-editor` - Monaco editor core
- `ws` - WebSocket library
- `@types/ws` - TypeScript definitions for ws
- `concurrently` - Run multiple npm scripts
- `ts-node` - Run TypeScript directly

### 2. Configure Environment Variables

Add the following to your `.env` file in the project root:

```env
# Twilio Configuration
REACT_APP_TWILIO_ACCOUNT_SID=your_account_sid_here
REACT_APP_TWILIO_API_KEY=your_api_key_here
REACT_APP_TWILIO_API_SECRET=your_api_secret_here

# WebSocket Server
REACT_APP_WS_URL=ws://localhost:8080

# Supabase (already configured)
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Database Migration

Execute the interview system migration in Supabase:

```bash
# Using Supabase CLI
supabase db push

# Or run manually in Supabase Dashboard > SQL Editor
# Copy and execute: supabase/migrations/20251001_interviews_system.sql
```

### 4. Start Development Servers

You can run both the React app and WebSocket server together:

```bash
npm run dev
```

Or run them separately:

**Terminal 1 - React App:**

```bash
npm start
```

**Terminal 2 - WebSocket Server:**

```bash
npm run start:ws
```

### 5. Test the Interview System

Navigate to the interview module in your application and test the features:

1. **Schedule an Interview**: Create a new interview with date/time
2. **Join an Interview**: Connect to video room and code editor
3. **Collaborate**: Test real-time code editing
4. **Submit Evaluation**: Complete the interview feedback form

## Getting Twilio Credentials

1. Sign up for a free Twilio account at https://www.twilio.com/try-twilio
2. Navigate to Console > Account > API Keys & Tokens
3. Create a new API Key for your application
4. Copy the SID, Key, and Secret to your `.env` file

## Troubleshooting

### WebSocket Connection Errors

If you see WebSocket connection errors:

- Ensure the WebSocket server is running (`npm run start:ws`)
- Check that `REACT_APP_WS_URL` in `.env` is correct
- Verify port 8080 is not blocked by firewall

### Twilio Video Connection Issues

If video fails to connect:

- Verify Twilio credentials in `.env` are correct
- Check browser console for error messages
- Ensure camera/microphone permissions are granted
- Test with a simpler video configuration (audio only)

### Database Migration Errors

If migration fails:

- Ensure you have proper Supabase project access
- Check that required tables don't already exist
- Verify database connection in Supabase dashboard

### Import Errors

If you see module not found errors:

- Run `npm install` to ensure all dependencies are installed
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript configuration in `tsconfig.json`

## Production Deployment

### Environment Setup

1. **Twilio Production Account**: Upgrade from trial account
2. **WebSocket Server**: Deploy to separate service (Heroku, AWS, Railway)
3. **Environment Variables**: Set all production credentials
4. **SSL/TLS**: Ensure HTTPS for app and WSS for WebSocket

### WebSocket Server Deployment

**Option 1: Heroku**

```bash
heroku create your-ws-server
heroku config:set NODE_ENV=production
git subtree push --prefix src/modules/interviews/server heroku main
```

**Option 2: Railway**

- Connect your GitHub repository
- Add new service with Dockerfile
- Set environment variables
- Deploy

**Option 3: AWS/DigitalOcean**

- Create EC2/Droplet instance
- Install Node.js
- Clone repository
- Run with PM2: `pm2 start websocket-server.ts`

### Database Migration

Run migrations on production Supabase:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

## Next Steps

1. **Customize Interview Templates**: Create templates for your interview types
2. **Add Interview Questions**: Populate the question bank
3. **Configure Recording**: Set up Twilio recording composition
4. **Implement Transcription**: Integrate transcription service (AWS Transcribe, etc.)
5. **Add Analytics**: Track interview metrics and outcomes
6. **Setup Notifications**: Email/SMS reminders for scheduled interviews

## API Documentation

See the main [README.md](./README.md) for comprehensive API documentation.

## Support

For issues or questions:

- Check the [README.md](./README.md) troubleshooting section
- Review browser console for error messages
- Check Supabase logs for database issues
- Verify all environment variables are set correctly
