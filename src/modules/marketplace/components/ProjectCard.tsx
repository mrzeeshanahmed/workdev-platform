import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Box,
  Button,
  Avatar,
  Rating,
} from '@mui/material';
import {
  LocationOn,
  AccessTime,
  Schedule,
  Star,
  TrendingUp,
  AttachMoney,
} from '@mui/icons-material';
import type { ProjectCard as ProjectCardType } from '../types';

interface ProjectCardProps {
  project: ProjectCardType;
  onClick?: () => void;
  onViewDetails?: (projectId: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, onViewDetails }) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (onViewDetails) {
      onViewDetails(project.id);
    }
  };

  const formatBudget = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount}`;
  };

  const getDaysAgo = (dateString: string) => {
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        border: project.is_featured ? '2px solid' : '1px solid',
        borderColor: project.is_featured ? 'primary.main' : 'divider',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6,
        },
      }}
      onClick={handleClick}
    >
      {project.is_featured && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            bgcolor: 'primary.main',
            color: 'white',
            px: 2,
            py: 0.5,
            borderBottomLeftRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Star fontSize="small" />
          <Typography variant="caption" fontWeight="bold">
            Featured
          </Typography>
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Title */}
        <Typography
          variant="h6"
          component="h3"
          gutterBottom
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            mt: project.is_featured ? 3 : 0,
          }}
        >
          {project.title}
        </Typography>

        {/* Description */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            mb: 2,
          }}
        >
          {project.description}
        </Typography>

        {/* Budget & Type */}
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Chip
            icon={<AttachMoney />}
            label={formatBudget(project.budget)}
            color="primary"
            size="small"
          />
          <Chip
            label={project.project_type === 'fixed' ? 'Fixed Price' : 'Hourly Rate'}
            size="small"
            variant="outlined"
          />
          {project.duration_estimate && (
            <Chip
              icon={<Schedule />}
              label={project.duration_estimate}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* Skills */}
        <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
          {project.skills_required?.slice(0, 5).map((skill) => (
            <Chip key={skill} label={skill} size="small" variant="filled" color="default" />
          ))}
          {project.skills_required && project.skills_required.length > 5 && (
            <Chip
              label={`+${project.skills_required.length - 5}`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* Client Info */}
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Avatar
            sx={{ width: 24, height: 24 }}
            alt={project.client_company || project.client_name}
          >
            {(project.client_company || project.client_name).charAt(0)}
          </Avatar>
          <Typography variant="body2" fontWeight="medium">
            {project.client_company || project.client_name}
          </Typography>
          {project.client_rating > 0 && (
            <Box display="flex" alignItems="center">
              <Rating value={project.client_rating} readOnly size="small" precision={0.1} />
              <Typography variant="caption" color="text.secondary" ml={0.5}>
                ({project.client_rating.toFixed(1)})
              </Typography>
            </Box>
          )}
        </Box>

        {/* Stats */}
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          {project.location && !project.is_remote && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <LocationOn fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {project.location}
              </Typography>
            </Box>
          )}
          {project.is_remote && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <LocationOn fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Remote
              </Typography>
            </Box>
          )}
          <Box display="flex" alignItems="center" gap={0.5}>
            <AccessTime fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              {getDaysAgo(project.created_at)}
            </Typography>
          </Box>
          {project.proposals_count > 0 && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <TrendingUp fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {project.proposals_count} proposals
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        >
          View Details
        </Button>
      </CardActions>
    </Card>
  );
};
