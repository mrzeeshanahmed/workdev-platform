/**
 * Interview Room Component
 *
 * Main component for conducting interviews with video calling and code editor
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Stack,
  Paper,
  Typography,
  IconButton,
  Button,
  Drawer,
  Tab,
  Tabs,
  Avatar,
  Chip,
  Alert,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import CallEndIcon from '@mui/icons-material/CallEnd';
import CodeIcon from '@mui/icons-material/Code';
import NotesIcon from '@mui/icons-material/Notes';
import PeopleIcon from '@mui/icons-material/People';
import { InterviewRoomProps, InterviewParticipant } from '../types';
import { VideoInterviewManager } from '../services/VideoInterviewManager';
import InterviewService from '../services/InterviewService';
import CollaborativeCodeEditor from './CollaborativeCodeEditor';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

export const InterviewRoom: React.FC<InterviewRoomProps> = ({
  interviewId,
  currentUserId,
  onLeave,
}) => {
  const [videoManager, setVideoManager] = useState<VideoInterviewManager | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<InterviewParticipant[]>([]);
  const [sidebarTab, setSidebarTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    initializeInterview();
    return () => {
      videoManager?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  const initializeInterview = async () => {
    try {
      // Join interview and get tokens
      const session = await InterviewService.joinInterview({
        interview_id: interviewId,
        user_id: currentUserId,
        role: 'developer',
      });

      setSessionData(session);
      setParticipants(session.participants);

      // Initialize video manager
      const manager = new VideoInterviewManager(interviewId);
      setVideoManager(manager);

      // Connect to video room
      await manager.connect(session.video_token, {
        audio: true,
        video: true,
      });

      // Update interview status to in_progress
      await InterviewService.updateInterviewStatus({
        interview_id: interviewId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join interview');
      console.error('Failed to initialize interview:', err);
    }
  };

  const handleToggleAudio = () => {
    if (videoManager) {
      const enabled = videoManager.toggleAudio();
      setIsAudioEnabled(enabled);
    }
  };

  const handleToggleVideo = () => {
    if (videoManager) {
      const enabled = videoManager.toggleVideo();
      setIsVideoEnabled(enabled);
    }
  };

  const handleToggleScreenShare = async () => {
    if (videoManager) {
      try {
        if (isScreenSharing) {
          await videoManager.stopScreenShare();
          setIsScreenSharing(false);
        } else {
          await videoManager.startScreenShare();
          setIsScreenSharing(true);
        }
      } catch (err) {
        console.error('Screen share error:', err);
        setError('Failed to toggle screen sharing');
      }
    }
  };

  const handleEndCall = async () => {
    try {
      videoManager?.disconnect();

      await InterviewService.updateInterviewStatus({
        interview_id: interviewId,
        status: 'completed',
        ended_at: new Date().toISOString(),
      });

      onLeave?.();
    } catch (err) {
      console.error('Failed to end call:', err);
      onLeave?.();
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'grey.900' }}>
      {/* Main Video Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Video Grid */}
        <Box sx={{ flex: 1, p: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Local Video */}
          <Paper
            sx={{
              flex: '1 1 45%',
              minHeight: 300,
              bgcolor: 'grey.800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Box
              component="video"
              id="local-video"
              autoPlay
              muted
              playsInline
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <Chip label="You" size="small" sx={{ position: 'absolute', bottom: 16, left: 16 }} />
          </Paper>

          {/* Remote Videos */}
          {participants.map((participant) => (
            <Paper
              key={participant.id}
              sx={{
                flex: '1 1 45%',
                minHeight: 300,
                bgcolor: 'grey.800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Box
                component="video"
                id={`remote-video-${participant.user_id}`}
                autoPlay
                playsInline
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <Chip
                label={participant.role}
                size="small"
                sx={{ position: 'absolute', bottom: 16, left: 16 }}
              />
            </Paper>
          ))}
        </Box>

        {/* Controls */}
        <Paper
          sx={{
            p: 2,
            borderRadius: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <IconButton
            onClick={handleToggleAudio}
            color={isAudioEnabled ? 'primary' : 'error'}
            size="large"
          >
            {isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
          </IconButton>

          <IconButton
            onClick={handleToggleVideo}
            color={isVideoEnabled ? 'primary' : 'error'}
            size="large"
          >
            {isVideoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
          </IconButton>

          <IconButton
            onClick={handleToggleScreenShare}
            color={isScreenSharing ? 'primary' : 'default'}
            size="large"
          >
            {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
          </IconButton>

          <Button
            variant="contained"
            color="error"
            startIcon={<CallEndIcon />}
            onClick={handleEndCall}
            size="large"
          >
            End Interview
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <IconButton onClick={() => setSidebarOpen(!sidebarOpen)} size="large">
            <CodeIcon />
          </IconButton>
        </Paper>
      </Box>

      {/* Sidebar */}
      <Drawer
        anchor="right"
        open={sidebarOpen}
        variant="persistent"
        sx={{
          width: 500,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 500,
            position: 'relative',
          },
        }}
      >
        <Tabs value={sidebarTab} onChange={(e, v) => setSidebarTab(v)}>
          <Tab icon={<CodeIcon />} label="Code" />
          <Tab icon={<NotesIcon />} label="Notes" />
          <Tab icon={<PeopleIcon />} label="Participants" />
        </Tabs>

        <TabPanel value={sidebarTab} index={0}>
          {sessionData?.code_session && (
            <CollaborativeCodeEditor
              sessionId={sessionData.code_session.id}
              interviewId={interviewId}
              currentUserId={currentUserId}
            />
          )}
        </TabPanel>

        <TabPanel value={sidebarTab} index={1}>
          <Stack spacing={2}>
            <Typography variant="h6">Interview Notes</Typography>
            <Typography variant="body2" color="text.secondary">
              Take notes during the interview
            </Typography>
          </Stack>
        </TabPanel>

        <TabPanel value={sidebarTab} index={2}>
          <Stack spacing={2}>
            <Typography variant="h6">Participants</Typography>
            {participants.map((participant) => (
              <Paper key={participant.id} sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar>{participant.role[0].toUpperCase()}</Avatar>
                  <Box>
                    <Typography variant="body1">{participant.role}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {participant.can_speak ? 'Can speak' : 'Observer'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </TabPanel>
      </Drawer>
    </Box>
  );
};

export default InterviewRoom;
