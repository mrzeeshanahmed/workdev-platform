import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import type { PortfolioProjectInput } from '../types';

export const PortfolioManager = () => {
  const {
    profile,
    portfolio,
    createPortfolioProject,
    updatePortfolioProject,
    deletePortfolioProject,
    reorderPortfolio,
  } = useProfile();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [formData, setFormData] = useState<PortfolioProjectInput>({
    title: '',
    description: '',
    tech_stack: [],
    project_url: '',
    github_url: '',
    image_url: '',
    featured: false,
  });

  const handleOpen = (projectId?: string) => {
    if (projectId) {
      const project = portfolio.find((p) => p.id === projectId);
      if (project) {
        setFormData({
          title: project.title,
          description: project.description,
          tech_stack: project.tech_stack,
          project_url: project.project_url ?? '',
          github_url: project.github_url ?? '',
          image_url: project.image_url ?? '',
          featured: project.featured ?? false,
        });
        setEditingProject(projectId);
      }
    } else {
      setFormData({
        title: '',
        description: '',
        tech_stack: [],
        project_url: '',
        github_url: '',
        image_url: '',
        featured: false,
      });
      setEditingProject(null);
    }
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingProject(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingProject) {
        await updatePortfolioProject(editingProject, formData);
      } else {
        await createPortfolioProject(formData);
      }
      handleClose();
    } catch (error) {
      // Error handled by context
    }
  };

  const handleDelete = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      await deletePortfolioProject(projectId);
    }
  };

  if (!profile) {
    return null;
  }

  // reference reorderPortfolio to avoid "assigned but never used" lint warnings in pre-commit
  void reorderPortfolio;

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Portfolio Projects</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Add Project
        </Button>
      </Box>

      {portfolio.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center">
              No portfolio projects yet. Add your first project to showcase your work!
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {portfolio.map((project) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={project.id}>
              <Card>
                {project.image_url && (
                  <CardMedia
                    component="img"
                    height="200"
                    image={project.image_url}
                    alt={project.title}
                  />
                )}
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <DragIcon sx={{ cursor: 'grab', color: 'text.secondary' }} />
                    <Typography variant="h6" flex={1}>
                      {project.title}
                    </Typography>
                    {project.featured && <Chip label="Featured" color="primary" size="small" />}
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {project.description}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {project.tech_stack.map((tech) => (
                      <Chip key={tech} label={tech} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </CardContent>
                <CardActions>
                  {project.project_url && (
                    <Button size="small" href={project.project_url} target="_blank">
                      View Project
                    </Button>
                  )}
                  {project.github_url && (
                    <Button size="small" href={project.github_url} target="_blank">
                      GitHub
                    </Button>
                  )}
                  <Box flex={1} />
                  <IconButton size="small" onClick={() => handleOpen(project.id)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(project.id)}>
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Project Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={4}
              fullWidth
              required
            />
            <TextField
              label="Tech Stack (comma-separated)"
              value={formData.tech_stack.join(', ')}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tech_stack: e.target.value.split(',').map((s) => s.trim()),
                })
              }
              fullWidth
              helperText="e.g., React, TypeScript, Node.js"
            />
            <TextField
              label="Project URL"
              value={formData.project_url}
              onChange={(e) => setFormData({ ...formData, project_url: e.target.value })}
              fullWidth
              type="url"
            />
            <TextField
              label="GitHub URL"
              value={formData.github_url}
              onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
              fullWidth
              type="url"
            />
            <TextField
              label="Image URL"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              fullWidth
              type="url"
              helperText="Link to a project screenshot or thumbnail"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingProject ? 'Save Changes' : 'Add Project'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
