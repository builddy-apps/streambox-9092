import express from 'express';
import db from '../db.js';
import { authenticate } from '../auth.js';

const router = express.Router();

// GET /api/extensions - List all installed extensions
router.get('/', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM extensions ORDER BY created_at DESC');
    const extensions = stmt.all();
    
    // Convert integer enabled to boolean for API consistency
    const data = extensions.map(ext => ({
      ...ext,
      enabled: Boolean(ext.enabled)
    }));
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching extensions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch extensions' });
  }
});

// PUT /api/extensions/:id/toggle - Toggle extension enabled status
router.put('/:id/toggle', authenticate, (req, res) => {
  const { id } = req.params;
  
  if (!id || isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid extension ID' });
  }
  
  try {
    // Check if extension exists
    const checkStmt = db.prepare('SELECT id, enabled FROM extensions WHERE id = ?');
    const extension = checkStmt.get(id);
    
    if (!extension) {
      return res.status(404).json({ success: false, error: 'Extension not found' });
    }
    
    // Toggle status (1 -> 0, 0 -> 1)
    const newStatus = extension.enabled === 1 ? 0 : 1;
    
    const updateStmt = db.prepare('UPDATE extensions SET enabled = ? WHERE id = ?');
    updateStmt.run(newStatus, id);
    
    res.json({ 
      success: true, 
      data: { 
        id: parseInt(id), 
        enabled: Boolean(newStatus),
        message: newStatus === 1 ? 'Extension enabled' : 'Extension disabled'
      } 
    });
  } catch (error) {
    console.error('Error toggling extension:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle extension' });
  }
});

// POST /api/extensions - Install new extension (simulated)
router.post('/', authenticate, (req, res) => {
  const { name, description, url } = req.body;
  
  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Extension name is required' });
  }
  
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Extension URL is required' });
  }
  
  try {
    // Simulate installation verification (in a real app, this would ping the URL)
    const isValidUrl = url.startsWith('http://') || url.startsWith('https://');
    
    if (!isValidUrl) {
      return res.status(400).json({ success: false, error: 'Invalid URL format' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO extensions (name, description, url, enabled) 
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      name.trim(),
      description ? description.trim() : null,
      url.trim(),
      1 // Enabled by default on install
    );
    
    // Fetch the newly created extension
    const newExtension = db.prepare('SELECT * FROM extensions WHERE id = ?').get(result.lastInsertRowid);
    
    if (newExtension) {
      newExtension.enabled = Boolean(newExtension.enabled);
    }
    
    res.status(201).json({ 
      success: true, 
      data: newExtension,
      message: 'Extension installed successfully' 
    });
  } catch (error) {
    console.error('Error installing extension:', error);
    
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ 
        success: false, 
        error: 'An extension with this configuration already exists' 
      });
    }
    
    res.status(500).json({ success: false, error: 'Failed to install extension' });
  }
});

// DELETE /api/extensions/:id - Remove/uninstall extension
router.delete('/:id', authenticate, (req, res) => {
  const { id } = req.params;
  
  if (!id || isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid extension ID' });
  }
  
  try {
    const stmt = db.prepare('DELETE FROM extensions WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Extension not found' });
    }
    
    res.json({ success: true, message: 'Extension removed successfully' });
  } catch (error) {
    console.error('Error removing extension:', error);
    res.status(500).json({ success: false, error: 'Failed to remove extension' });
  }
});

export default router;