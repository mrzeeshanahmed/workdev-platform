# Interview System Documentation

## Overview

The WorkDev Interview System is a comprehensive platform for conducting technical interviews with integrated video calling, collaborative code editing, and structured evaluation. Built with React, TypeScript, Twilio Video, Monaco Editor, and WebSockets.

## Features

- **Video Calling**: Real-time video interviews with up to 4 participants using Twilio Video SDK
- **Collaborative Code Editor**: Monaco Editor with WebSocket synchronization for real-time code collaboration
- **Interview Scheduling**: Calendar-based scheduling with conflict detection
- **Interview Evaluation**: Structured feedback forms with ratings and recommendations
- **Recording & Transcription**: Automatic recording with transcription support
- **Question Bank**: Pre-built library of technical and behavioral questions
- **Interview Templates**: Reusable interview structures with agendas
- **GDPR Compliance**: Full data privacy and consent management

## Architecture

```
interviews/
├── types.ts                    # TypeScript type definitions
├── services/
│   ├── VideoInterviewManager.ts    # Twilio video integration
│   └── InterviewService.ts         # Core business logic
├── components/
│   ├── InterviewRoom.tsx           # Main interview UI
│   ├── CollaborativeCodeEditor.tsx # Code editor component
│   ├── ScheduleInterview.tsx       # Scheduling component
│   ├── InterviewEvaluation.tsx     # Evaluation form
│   └── InterviewHistory.tsx        # Interview list
└── server/
    └── websocket-server.ts         # Real-time collaboration server
```

## Installation

### 1. Install Dependencies

```bash
npm install twilio-video @monaco-editor/react ws
npm install --save-dev @types/ws
```

### 2. Environment Variables

Add to `.env`:

```env
# Twilio Configuration
REACT_APP_TWILIO_ACCOUNT_SID=your_account_sid
REACT_APP_TWILIO_API_KEY=your_api_key
REACT_APP_TWILIO_API_SECRET=your_api_secret

# WebSocket Server
REACT_APP_WS_URL=ws://localhost:8080

# Supabase (already configured)
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Database Migration

Run the interview system migration:

```bash
supabase migration up 20251001_interviews_system.sql
```

### 4. Start WebSocket Server

```bash
# In a separate terminal
ts-node src/modules/interviews/server/websocket-server.ts
```

Or add to `package.json`:

```json
{
  "scripts": {
    "start:ws": "ts-node src/modules/interviews/server/websocket-server.ts",
    "dev": "concurrently \"npm start\" \"npm run start:ws\""
  }
}
```

## Usage

### Schedule an Interview

```typescript
import InterviewService from './modules/interviews/services/InterviewService';

const interview = await InterviewService.scheduleInterview({
  client_user_id: 'client-uuid',
  developer_user_id: 'developer-uuid',
  project_id: 'project-uuid',
  scheduled_at: '2025-10-15T14:00:00Z',
  duration_minutes: 60,
  timezone: 'America/New_York',
  interview_type: 'technical',
  title: 'Senior React Developer Interview',
  description: 'Technical interview focusing on React, TypeScript, and system design',
  agenda: [
    { time: 5, activity: 'Introduction and ice breaker' },
    { time: 20, activity: 'Technical discussion' },
    { time: 30, activity: 'Coding challenge' },
    { time: 5, activity: 'Q&A and wrap-up' },
  ],
  recording_enabled: true,
});

console.log('Interview scheduled:', interview.id);
```

### Join an Interview

```typescript
import { InterviewRoom } from './modules/interviews/components/InterviewRoom';

function App() {
  const interviewId = 'interview-uuid';
  const currentUserId = 'user-uuid';

  return (
    <InterviewRoom
      interviewId={interviewId}
      currentUserId={currentUserId}
      onLeave={() => console.log('Interview ended')}
    />
  );
}
```

### Submit Evaluation

```typescript
const evaluation = await InterviewService.submitEvaluation({
  interview_id: 'interview-uuid',
  evaluator_user_id: 'evaluator-uuid',
  evaluation_data: {
    overall_rating: 4.5,
    technical_skills: 5,
    communication: 4,
    problem_solving: 4.5,
    cultural_fit: 4,
    code_quality_score: 4.5,
    strengths: 'Excellent problem-solving skills, clean code, good communication',
    areas_for_improvement: 'Could improve on system design experience',
    notes: 'Strong candidate, recommended for hire',
    recommended_for_hire: true,
    next_steps: 'Schedule final round with CTO',
    skills_assessment: {
      React: 5,
      TypeScript: 4,
      'System Design': 3,
      Algorithms: 4,
    },
  },
});
```

## API Reference

### InterviewService

#### `scheduleInterview(request: ScheduleInterviewRequest): Promise<Interview>`

Schedule a new interview with conflict detection.

#### `joinInterview(request: JoinInterviewRequest): Promise<JoinInterviewResponse>`

Join an interview and receive video tokens and session info.

#### `updateInterviewStatus(request: UpdateInterviewStatusRequest): Promise<Interview>`

Update interview status (scheduled → in_progress → completed).

#### `cancelInterview(interviewId: string, userId: string): Promise<void>`

Cancel a scheduled interview.

#### `submitEvaluation(request: SubmitEvaluationRequest): Promise<InterviewEvaluation>`

Submit structured evaluation after interview.

#### `getInterviews(request: GetInterviewsRequest): Promise<GetInterviewsResponse>`

Get paginated list of interviews with filters.

#### `getInterviewStatistics(userId: string, role?: string): Promise<InterviewStatistics>`

Get aggregate statistics (total interviews, avg rating, etc.).

#### `getUpcomingInterviews(userId: string, limit?: number): Promise<any[]>`

Get upcoming scheduled interviews.

#### `addNote(interviewId: string, userId: string, content: string): Promise<InterviewNote>`

Add real-time notes during interview.

#### `getNotes(interviewId: string, userId: string): Promise<InterviewNote[]>`

Get all notes for an interview.

#### `getQuestions(filters?: object): Promise<InterviewQuestion[]>`

Get interview questions from the question bank.

#### `getTemplates(isPublicOnly?: boolean): Promise<InterviewTemplate[]>`

Get reusable interview templates.

### VideoInterviewManager

#### `connect(token: string, config?: VideoCallConfig): Promise<VideoSession>`

Connect to a Twilio video room.

#### `disconnect(): void`

Disconnect from video room and clean up tracks.

#### `toggleAudio(): boolean`

Toggle microphone on/off, returns new state.

#### `toggleVideo(): boolean`

Toggle camera on/off, returns new state.

#### `startScreenShare(): Promise<void>`

Start sharing screen.

#### `stopScreenShare(): Promise<void>`

Stop sharing screen.

#### `startRecording(): Promise<void>`

Start recording the interview (server-side).

#### `stopRecording(): Promise<void>`

Stop recording the interview.

#### `getMediaDevices(): Promise<MediaDevices>`

Get available audio/video devices.

#### `switchAudioInput(deviceId: string): Promise<void>`

Switch to different microphone.

#### `switchVideoInput(deviceId: string): Promise<void>`

Switch to different camera.

#### `on(event: string, handler: Function): void`

Subscribe to events (participant-connected, track-subscribed, etc.).

## Database Schema

### Core Tables

- **interviews**: Core interview records with scheduling and video call info
- **interview_participants**: Additional participants (interviewers, observers)
- **code_editor_sessions**: Collaborative code editing sessions
- **interview_evaluations**: Structured feedback and ratings
- **interview_notes**: Real-time notes taken during interviews
- **interview_recordings**: Video/audio recording metadata
- **interview_questions**: Question bank for technical interviews
- **interview_question_usage**: Track which questions were asked
- **interview_templates**: Reusable interview structures

### Key Functions

- `get_upcoming_interviews(p_user_id, p_limit)`: Get scheduled interviews
- `get_interview_statistics(p_user_id, p_role)`: Aggregate stats
- `check_interview_conflicts(p_user_id, p_scheduled_at, p_duration_minutes)`: Conflict detection
- `generate_interview_room_tokens(p_interview_id)`: Generate Twilio tokens

## Security & Compliance

### Row Level Security (RLS)

All tables have RLS policies to ensure users can only access their own data:

- Users can only view interviews they're part of
- Evaluations visible to evaluator and interview owner
- Private notes only visible to author
- Recordings require consent to access

### GDPR Compliance

- Explicit consent tracking for recordings
- Data retention policies (30/90/indefinite days)
- Automatic expiration of recordings
- User data deletion cascades

### Best Practices

1. **Tokens**: Never expose Twilio credentials on client-side
2. **Recording Consent**: Always obtain consent before recording
3. **Data Retention**: Set appropriate retention policies
4. **Access Control**: Use RLS policies for all database operations
5. **Secure WebSocket**: Use WSS (WebSocket Secure) in production
6. **Code Execution**: Never execute user code client-side, use sandboxed backend

## Advanced Usage

### Custom Interview Flow

```typescript
// Create custom interview template
const template = await supabaseClient
  .from('interview_templates')
  .insert({
    name: 'Full Stack Engineer Interview',
    description: '2-hour comprehensive technical interview',
    interview_type: 'technical',
    duration_minutes: 120,
    requires_code_editor: true,
    requires_screen_share: true,
    recording_required: true,
    agenda: [
      { time: 10, activity: 'Intro & background' },
      { time: 40, activity: 'Frontend coding challenge' },
      { time: 40, activity: 'Backend system design' },
      { time: 20, activity: 'Database & architecture discussion' },
      { time: 10, activity: 'Q&A and next steps' },
    ],
  })
  .select()
  .single();
```

### Real-time Collaboration

The WebSocket server handles:

- **Operational Transformation**: Conflict-free concurrent editing
- **Cursor Synchronization**: See where others are typing
- **Language Switching**: Synchronized across all participants
- **Code Execution**: Server-side sandbox execution

### Video Quality Optimization

```typescript
const videoManager = new VideoInterviewManager(interviewId);

await videoManager.connect(token, {
  audio: true,
  video: true,
  maxParticipants: 4,
  bandwidthProfile: {
    video: {
      mode: 'collaboration', // 'collaboration' | 'presentation' | 'grid'
      maxTracks: 4,
      dominantSpeakerPriority: 'high',
    },
  },
});
```

## Troubleshooting

### Video Connection Issues

```typescript
// Check network quality
videoManager.on('network-quality-changed', ({ quality }) => {
  console.log('Network quality:', quality);
  if (quality < 2) {
    alert('Poor network connection detected');
  }
});

// Handle connection errors
try {
  await videoManager.connect(token);
} catch (error) {
  console.error('Failed to connect:', error);
  // Fallback to audio-only mode
  await videoManager.connect(token, { audio: true, video: false });
}
```

### WebSocket Reconnection

```typescript
let ws: WebSocket;
let reconnectAttempts = 0;
const MAX_RECONNECTS = 5;

function connectWebSocket() {
  ws = new WebSocket(`ws://localhost:8080/code-session/${sessionId}`);

  ws.onclose = () => {
    if (reconnectAttempts < MAX_RECONNECTS) {
      reconnectAttempts++;
      setTimeout(connectWebSocket, 1000 * reconnectAttempts);
    }
  };

  ws.onopen = () => {
    reconnectAttempts = 0;
  };
}
```

### Supabase Null Check

```typescript
import { supabaseClient } from '../config/supabase/client';

async function safeQuery() {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabaseClient.from('interviews').select('*');

  if (error) throw error;
  return data;
}
```

## Production Deployment

### Environment Setup

1. **Twilio**: Set up production credentials
2. **WebSocket Server**: Deploy to separate instance (Heroku, AWS, etc.)
3. **Database**: Run migrations on production Supabase
4. **CDN**: Serve Monaco Editor from CDN for faster loading
5. **SSL/TLS**: Enable HTTPS and WSS

### Performance Optimization

- Use code splitting for Monaco Editor (large bundle)
- Implement lazy loading for interview components
- Cache interview questions and templates
- Use Twilio's bandwidth profiles for optimal video quality
- Implement reconnection logic for WebSocket

### Monitoring

```typescript
// Track interview metrics
videoManager.on('stats-updated', (stats) => {
  // Send to analytics service
  analytics.track('video_quality', {
    bitrate: stats.bitrate,
    packetLoss: stats.packetLoss,
    jitter: stats.jitter,
  });
});
```

## License

MIT

## Support

For issues, questions, or feature requests, please create an issue in the repository.
