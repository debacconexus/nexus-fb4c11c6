const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database tables
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delegates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        country VARCHAR(100) NOT NULL,
        position VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS resolutions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        resolution_number VARCHAR(100),
        session_year INTEGER,
        committee VARCHAR(255),
        status VARCHAR(100) DEFAULT 'draft',
        priority_level VARCHAR(50) DEFAULT 'medium',
        description TEXT,
        ruby_guillen_position TEXT,
        nasw_ca_stance VARCHAR(100),
        submission_date DATE,
        voting_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS voting_records (
        id SERIAL PRIMARY KEY,
        resolution_id INTEGER REFERENCES resolutions(id) ON DELETE CASCADE,
        country VARCHAR(100) NOT NULL,
        vote VARCHAR(20) NOT NULL,
        delegate_id INTEGER REFERENCES delegates(id),
        vote_date DATE,
        explanation TEXT,
        influence_level VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS multilateral_submissions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        submission_type VARCHAR(100),
        target_body VARCHAR(255),
        lead_country VARCHAR(100),
        supporting_countries TEXT[],
        submission_date DATE,
        status VARCHAR(100) DEFAULT 'pending',
        ruby_position TEXT,
        advocacy_strategy TEXT,
        outcome VARCHAR(255),
        follow_up_required BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS advocacy_contacts (
        id SERIAL PRIMARY KEY,
        contact_type VARCHAR(100) NOT NULL,
        organization VARCHAR(255),
        contact_name VARCHAR(255),
        position VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        country VARCHAR(100),
        relationship_strength VARCHAR(50),
        last_contact_date DATE,
        next_follow_up DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS policy_tracking (
        id SERIAL PRIMARY KEY,
        policy_area VARCHAR(255) NOT NULL,
        un_body VARCHAR(255),
        current_status VARCHAR(100),
        ruby_priority VARCHAR(50),
        next_milestone DATE,
        key_stakeholders TEXT[],
        advocacy_actions TEXT[],
        success_metrics TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// API Routes

// Delegates CRUD
app.get('/api/delegates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM delegates ORDER BY country, name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/delegates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM delegates WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delegate not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/delegates', async (req, res) => {
  try {
    const { name, country, position, email, phone, status, notes } = req.body;
    const noteWithTag = notes ? `[IGM-GOVERNED] ${notes}` : '[IGM-GOVERNED] New delegate entry';
    
    const result = await pool.query(
      'INSERT INTO delegates (name, country, position, email, phone, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, country, position, email, phone, status || 'active', noteWithTag]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/delegates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, country, position, email, phone, status, notes } = req.body;
    const noteWithTag = notes ? `[IGM-GOVERNED] ${notes}` : '[IGM-GOVERNED] Updated delegate entry';
    
    const result = await pool.query(
      'UPDATE delegates SET name = $1, country = $2, position = $3, email = $4, phone = $5, status = $6, notes = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8 RETURNING *',
      [name, country, position, email, phone, status, noteWithTag, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delegate not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/delegates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM delegates WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delegate not found' });
    }
    res.json({ message: 'Delegate deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolutions CRUD
app.get('/api/resolutions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resolutions ORDER BY session_year DESC, title');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/resolutions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM resolutions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resolution not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/resolutions', async (req, res) => {
  try {
    const { title, resolution_number, session_year, committee, status, priority_level, description, ruby_guillen_position, nasw_ca_stance, submission_date, voting_date, notes } = req.body;
    const noteWithTag = notes ? `[IGM-GOVERNED] ${notes}` : '[IGM-GOVERNED] New resolution entry';
    
    const result = await pool.query(
      'INSERT INTO resolutions (title, resolution_number, session_year, committee, status, priority_level, description, ruby_guillen_position, nasw_ca_stance, submission_date, voting_date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
      [title, resolution_number, session_year, committee, status || 'draft', priority_level || 'medium', description, ruby_guillen_position, nasw_ca_stance, submission_date, voting_date, noteWithTag]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/resolutions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, resolution_number, session_year, committee, status, priority_level, description, ruby_guillen_position, nasw_ca_stance, submission_date, voting_date, notes } = req.body;
    const noteWithTag = notes ? `[IGM-GOVERNED] ${notes}` : '[IGM-GOVERNED] Updated resolution entry';
    
    const result = await pool.query(
      'UPDATE resolutions SET title = $1, resolution_number = $2, session_year = $3, committee = $4, status = $5, priority_level = $6, description = $7, ruby_guillen_position = $8, nasw_ca_stance = $9, submission_date = $10, voting_date = $11, notes = $12, updated_at = CURRENT_TIMESTAMP WHERE id = $13 RETURNING *',
      [title, resolution_number, session_year, committee, status, priority_level, description, ruby_guillen_position, nasw_ca_stance, submission_date, voting_date, noteWithTag, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resolution not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/resolutions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM resolutions WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resolution not found' });
    }
    res.json({ message: 'Resolution deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Voting Records CRUD
app.get('/api/voting-records', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vr.*, r.title as resolution_title, d.name as delegate_name 
      FROM voting_records vr 
      LEFT JOIN resolutions r ON vr.resolution_id = r.id 
      LEFT JOIN delegates d ON vr.delegate_id = d.id 
      ORDER BY vr.vote_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/voting-records/resolution/:resolutionId', async (req, res) => {
  try {
    const { resolutionId } = req.params;
    const result = await pool.query(`
      SELECT vr.*, d.name as delegate_name 
      FROM voting_records vr 
      LEFT JOIN delegates d ON vr.delegate_id = d.id 
      WHERE vr.resolution_id = $1 
      ORDER BY vr.country
    `, [resolutionId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/voting-records', async (req, res) => {
  try {
    const { resolution_id, country, vote, delegate_id, vote_date, explanation, influence_level, notes } = req.body;
    const noteWithTag = notes ? `[IGM-GOVERNED] ${notes}` : '[IGM-GOVERNED] New voting record';
    
    const result = await pool.query(
      'INSERT INTO voting_records (resolution_id, country, vote, delegate_id, vote_date, explanation, influence_level, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [resolution_id, country, vote, delegate_id, vote_date, explanation, influence_level, noteWithTag]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/voting-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_id, country, vote, delegate_id, vote_date, explanation, influence_level, notes } = req.body;
    const noteWithTag = notes ? `[IGM-GOVERNED] ${notes}` : '[IGM-GOVERNED] Updated voting record';
    
    const result = await pool.query(
      'UPDATE voting_records SET resolution_id = $1, country = $2, vote = $3, delegate_id = $4, vote_date = $5, explanation = $6, influence_level = $7, notes = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *',
      [resolution_id, country, vote, delegate_id, vote_date, explanation, influence_level, noteWithTag, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voting record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/voting-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM voting_records WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voting record not found' });
    }
    res.json({ message: 'Voting record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Multilateral Submissions CRUD
app.get('/api/multilateral-submissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM multilateral_submissions ORDER BY submission_date DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/multilateral-submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM multilateral_submissions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Multilateral submission not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/multilateral-submissions', async (req, res) => {
  try {
    const { title, submission_type, target_body, lead_country, supporting_countries, submission_date, status, ruby_position, advocacy_strategy, outcome, follow_up_required, notes } = req.body;
    const noteWithTag = notes ? `[IGM-GOVERNED] ${notes}` : '[IGM-GOVERNED] New multilateral submission';
    
    const result = await pool.query(
      'INSERT INTO multilateral_submissions (title, submission_type, target_body, lead_country, supporting_countries, submission_date, status, ruby_position, advocacy_strategy, outcome, follow_up_required, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
      [title, submission_type, target_body, lead_country, supporting_countries, submission_date, status || 'pending', ruby_position, advocacy_strategy, outcome, follow_up_required || false, noteWithTag]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/multilateral-submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, submission_type, target_body, lead_country, supporting_countries, submission_date, status, ruby_position, advocacy_strategy, outcome, follow_up_required, notes } = req.body;
    const noteWithTag = notes ? `[IGM-GOVERNED] ${notes}` : '[IGM-GOVERNED] Updated multilateral submission';
    
    const result = await pool.query(
      'UPDATE multilateral_submissions SET title = $1, submission_type = $2, target_body = $3, lead_country = $4, supporting_countries = $5, submission_date = $6, status = $7, ruby_position = $8, advocacy_strategy = $9, outcome = $10, follow_up_required = $11, notes = $12, updated_at = CURRENT_TIMESTAMP WHERE id = $13 RETURNING *',
      [title, submission_type, target_body, lead_country, supporting_countries, submission_date, status, ruby_position, advocacy_strategy, outcome, follow_up_required, noteWithTag, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Multilateral submission not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/multilateral-submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM multilateral_submissions WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(