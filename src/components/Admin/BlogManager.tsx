import React from 'react';
import {
  Box,
  Typography,
  Alert,
  Card,
  CardContent,
  Button,
  Stack,
  Chip,
  Sheet,
  Table,
} from '@mui/joy';
import { Article, Add, Warning } from '@mui/icons-material';
import { useIsAdmin } from '../../hooks/useIsAdmin';

export default function BlogManager() {
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography level="body-sm">Loading...</Typography>
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Alert color="danger" startDecorator={<Warning />}>
        Unauthorized: You do not have admin access
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography level="h2" startDecorator={<Article />}>
              📝 Blog Management
            </Typography>
            <Typography level="body-sm" color="neutral">
              Create and manage homepage content (90's newspaper theme)
            </Typography>
          </Box>
          <Chip color="warning" variant="soft" size="sm">
            Admin Only
          </Chip>
        </Stack>
      </Box>

      {/* Quick Stats */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography level="body-xs" color="neutral">Total Posts</Typography>
            <Typography level="h3">0</Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography level="body-xs" color="neutral">Published</Typography>
            <Typography level="h3">0</Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography level="body-xs" color="neutral">Drafts</Typography>
            <Typography level="h3">0</Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Actions */}
      <Box sx={{ mb: 3 }}>
        <Button startDecorator={<Add />} size="lg" fullWidth>
          Create New Blog Post
        </Button>
      </Box>

      {/* Blog Posts List */}
      <Card variant="outlined">
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2 }}>
            Recent Posts
          </Typography>
          
          <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'hidden' }}>
            <Table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5}>
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography level="body-sm" color="neutral">
                        No blog posts yet. Create your first post to get started!
                      </Typography>
                    </Box>
                  </td>
                </tr>
              </tbody>
            </Table>
          </Sheet>
        </CardContent>
      </Card>

      {/* Coming Soon Notice */}
      <Alert color="primary" sx={{ mt: 3 }}>
        <Typography level="body-sm">
          <strong>Coming Soon:</strong> Full blog editor with markdown support, 
          image uploads, and scheduling. This will power the 90's newspaper-themed homepage!
        </Typography>
      </Alert>
    </Box>
  );
}

