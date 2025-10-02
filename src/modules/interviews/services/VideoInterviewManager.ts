/**
 * Video Interview Manager
 *
 * Manages Twilio Video integration for real-time video interviews
 * Handles room connection, participant management, recording, and media devices
 */

import {
  connect,
  Room,
  RemoteParticipant as TwilioRemoteParticipant,
  createLocalTracks,
} from 'twilio-video';
import {
  VideoSession,
  LocalParticipant,
  RemoteParticipant,
  VideoCallConfig,
  MediaDevices,
  ConnectionQuality,
} from '../types';

export class VideoInterviewManager {
  private room: Room | null = null;
  private localTracks: any[] = [];
  private participants: Map<string, RemoteParticipant> = new Map();
  private eventHandlers: Map<string, Set<Function>> = new Map();

  constructor(private interviewId: string) {}

  /**
   * Connect to a video interview room
   */
  async connect(
    token: string,
    config: VideoCallConfig = { audio: true, video: true },
  ): Promise<VideoSession> {
    try {
      // Create local tracks
      this.localTracks = await createLocalTracks({
        audio: config.audio,
        video: config.video ? { width: 1280, height: 720 } : false,
      });

      // Connect to the room
      this.room = await connect(token, {
        name: `interview-${this.interviewId}`,
        tracks: this.localTracks,
        bandwidthProfile: config.bandwidthProfile,
        maxAudioBitrate: 16000,
        preferredVideoCodecs: ['VP8', 'H264'],
        networkQuality: {
          local: 1,
          remote: 1,
        },
      });

      // Set up event listeners
      this.setupRoomEventListeners();

      // Add existing participants
      this.room.participants.forEach((participant: TwilioRemoteParticipant) => {
        this.addParticipant(participant);
      });

      return this.getCurrentSession();
    } catch (error) {
      console.error('Failed to connect to video room:', error);
      throw new Error(
        `Video connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Disconnect from the video room
   */
  disconnect(): void {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }

    // Stop all local tracks
    this.localTracks.forEach((track) => {
      track.stop();
    });
    this.localTracks = [];

    // Clear participants
    this.participants.clear();

    // Clear event handlers
    this.eventHandlers.clear();
  }

  /**
   * Toggle local audio on/off
   */
  toggleAudio(): boolean {
    const audioTrack = this.localTracks.find((track) => track.kind === 'audio');
    if (audioTrack) {
      if (audioTrack.isEnabled) {
        audioTrack.disable();
      } else {
        audioTrack.enable();
      }
      return audioTrack.isEnabled;
    }
    return false;
  }

  /**
   * Toggle local video on/off
   */
  toggleVideo(): boolean {
    const videoTrack = this.localTracks.find((track) => track.kind === 'video');
    if (videoTrack) {
      if (videoTrack.isEnabled) {
        videoTrack.disable();
      } else {
        videoTrack.enable();
      }
      return videoTrack.isEnabled;
    }
    return false;
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<void> {
    try {
      // @ts-ignore - screen capture API with extended properties
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // @ts-ignore - extended display media constraints
          cursor: 'always',
          displaySurface: 'monitor',
        } as MediaTrackConstraints,
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      if (this.room) {
        // Remove existing video track
        const existingVideoTrack = this.localTracks.find((track) => track.kind === 'video');
        if (existingVideoTrack) {
          this.room.localParticipant.unpublishTrack(existingVideoTrack);
        }

        // Publish screen track
        await this.room.localParticipant.publishTrack(screenTrack);
        this.localTracks.push(screenTrack);

        // Handle screen share stop
        screenTrack.onended = () => {
          this.stopScreenShare();
        };
      }
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      throw new Error('Screen sharing failed');
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    const screenTrack = this.localTracks.find(
      (track) => track.kind === 'video' && (track as any).name === 'screen',
    );

    if (screenTrack && this.room) {
      this.room.localParticipant.unpublishTrack(screenTrack);
      screenTrack.stop();
      this.localTracks = this.localTracks.filter((track) => track !== screenTrack);

      // Re-enable camera
      const localTracks = await createLocalTracks({ video: true });
      const videoTrack = localTracks.find((track: any) => track.kind === 'video');
      if (videoTrack) {
        await this.room.localParticipant.publishTrack(videoTrack);
        this.localTracks.push(videoTrack);
      }
    }
  }

  /**
   * Start recording the interview
   */
  async startRecording(): Promise<void> {
    // Recording is typically handled server-side via Twilio Composition API
    // This method would trigger a backend API call
    console.log('Recording started for interview:', this.interviewId);
    this.emit('recording-started', { interviewId: this.interviewId });
  }

  /**
   * Stop recording the interview
   */
  async stopRecording(): Promise<void> {
    // Stop recording via backend API
    console.log('Recording stopped for interview:', this.interviewId);
    this.emit('recording-stopped', { interviewId: this.interviewId });
  }

  /**
   * Get available media devices
   */
  async getMediaDevices(): Promise<MediaDevices> {
    const devices = await navigator.mediaDevices.enumerateDevices();

    return {
      audioInputs: devices.filter((d) => d.kind === 'audioinput'),
      audioOutputs: devices.filter((d) => d.kind === 'audiooutput'),
      videoInputs: devices.filter((d) => d.kind === 'videoinput'),
    };
  }

  /**
   * Switch audio input device
   */
  async switchAudioInput(deviceId: string): Promise<void> {
    const audioTrack = this.localTracks.find((track) => track.kind === 'audio');
    if (audioTrack && this.room) {
      // Create new audio track with selected device
      const newAudioTrack = await createLocalTracks({
        audio: { deviceId: { exact: deviceId } },
      });

      // Replace the audio track
      await this.room.localParticipant.unpublishTrack(audioTrack);
      audioTrack.stop();

      const newTrack = newAudioTrack[0];
      await this.room.localParticipant.publishTrack(newTrack);

      this.localTracks = this.localTracks.filter((t) => t !== audioTrack);
      this.localTracks.push(newTrack);
    }
  }

  /**
   * Switch video input device
   */
  async switchVideoInput(deviceId: string): Promise<void> {
    const videoTrack = this.localTracks.find((track) => track.kind === 'video');
    if (videoTrack && this.room) {
      // Create new video track with selected device
      const newVideoTrack = await createLocalTracks({
        video: { deviceId: { exact: deviceId }, width: 1280, height: 720 },
      });

      // Replace the video track
      await this.room.localParticipant.unpublishTrack(videoTrack);
      videoTrack.stop();

      const newTrack = newVideoTrack[0];
      await this.room.localParticipant.publishTrack(newTrack);

      this.localTracks = this.localTracks.filter((t) => t !== videoTrack);
      this.localTracks.push(newTrack);
    }
  }

  /**
   * Get current video session state
   */
  getCurrentSession(): VideoSession {
    const localParticipant: LocalParticipant = {
      identity: this.room?.localParticipant.identity || '',
      audioTrack: this.localTracks.find((t) => t.kind === 'audio'),
      videoTrack: this.localTracks.find((t) => t.kind === 'video'),
      isAudioEnabled: this.localTracks.find((t) => t.kind === 'audio')?.isEnabled || false,
      isVideoEnabled: this.localTracks.find((t) => t.kind === 'video')?.isEnabled || false,
      isScreenSharing: false,
    };

    return {
      interview_id: this.interviewId,
      room: this.room,
      localParticipant,
      remoteParticipants: this.participants,
      isConnected: this.room?.state === 'connected',
      isRecording: false,
      connectionQuality: this.getConnectionQuality(),
    };
  }

  /**
   * Get connection quality metrics
   */
  private getConnectionQuality(): ConnectionQuality {
    // This would be based on Twilio's network quality stats
    return {
      video: 'good',
      audio: 'excellent',
      network: 'stable',
    };
  }

  /**
   * Set up room event listeners
   */
  private setupRoomEventListeners(): void {
    if (!this.room) return;

    // Participant connected
    this.room.on('participantConnected', (participant: any) => {
      console.log(`Participant connected: ${participant.identity}`);
      this.addParticipant(participant);
      this.emit('participant-connected', { participant });
    });

    // Participant disconnected
    this.room.on('participantDisconnected', (participant: any) => {
      console.log(`Participant disconnected: ${participant.identity}`);
      this.removeParticipant(participant.sid);
      this.emit('participant-disconnected', { participant });
    });

    // Track subscribed
    this.room.on('trackSubscribed', (track: any, publication: any, participant: any) => {
      console.log(`Track subscribed: ${track.kind} from ${participant.identity}`);
      this.emit('track-subscribed', { track, participant });
    });

    // Track unsubscribed
    this.room.on('trackUnsubscribed', (track: any, publication: any, participant: any) => {
      console.log(`Track unsubscribed: ${track.kind} from ${participant.identity}`);
      this.emit('track-unsubscribed', { track, participant });
    });

    // Room disconnected
    this.room.on('disconnected', (room: any, error: any) => {
      console.log('Disconnected from room', error);
      this.emit('disconnected', { error });
    });

    // Dominant speaker changed
    this.room.on('dominantSpeakerChanged', (participant: any) => {
      console.log(`Dominant speaker: ${participant?.identity}`);
      this.emit('dominant-speaker-changed', { participant });
    });
  }

  /**
   * Add a remote participant
   */
  private addParticipant(twilioParticipant: TwilioRemoteParticipant): void {
    const participant: RemoteParticipant = {
      identity: twilioParticipant.identity,
      sid: twilioParticipant.sid,
      connectionQuality: {
        video: 'good',
        audio: 'good',
        network: 'stable',
      },
    };

    // Subscribe to tracks
    twilioParticipant.tracks.forEach((publication: any) => {
      if (publication.track) {
        this.attachTrack(participant, publication.track);
      }
    });

    // Listen for new tracks
    twilioParticipant.on('trackSubscribed', (track: any) => {
      this.attachTrack(participant, track);
    });

    this.participants.set(twilioParticipant.sid, participant);
  }

  /**
   * Remove a remote participant
   */
  private removeParticipant(sid: string): void {
    this.participants.delete(sid);
  }

  /**
   * Attach a track to a participant
   */
  private attachTrack(participant: RemoteParticipant, track: any): void {
    if (track.kind === 'audio') {
      participant.audioTrack = track;
    } else if (track.kind === 'video') {
      participant.videoTrack = track;
    }
  }

  /**
   * Event emitter
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }
}
