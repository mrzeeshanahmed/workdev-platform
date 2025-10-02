/**
 * Interview Module - Main Entry Point
 *
 * Exports all components, services, types, and utilities
 */

import { InterviewRoom } from './components/InterviewRoom';
import { CollaborativeCodeEditor } from './components/CollaborativeCodeEditor';
import { VideoInterviewManager } from './services/VideoInterviewManager';
import InterviewService from './services/InterviewService';

// Types
export * from './types';

// Services
export { VideoInterviewManager } from './services/VideoInterviewManager';
export { InterviewService } from './services/InterviewService';
export { default as InterviewServiceDefault } from './services/InterviewService';

// Components
export { InterviewRoom } from './components/InterviewRoom';
export { CollaborativeCodeEditor } from './components/CollaborativeCodeEditor';

// Default exports for convenience
const interviewsModule = {
  components: {
    InterviewRoom,
    CollaborativeCodeEditor,
  },
  services: {
    VideoInterviewManager,
    InterviewService,
  },
};

export default interviewsModule;
