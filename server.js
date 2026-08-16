require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const publicDir = path.join(__dirname, 'public');
const adminDir = path.join(publicDir, 'admin');
const mainTemplatePath = path.join(publicDir, 'index.template.html');

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required.');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

function signAdminToken(admin) {
  return jwt.sign(
    {
      sub: admin.id,
      username: admin.username
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  return req.cookies.admin_token || bearerToken;
}

async function requireAdmin(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      'SELECT id, username, created_at, updated_at FROM admin_users WHERE id = $1',
      [payload.sub]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.admin = result.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

async function bootstrapDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      estimated_total_value TEXT NOT NULL DEFAULT '0.00',
      estimated_total_currency TEXT NOT NULL DEFAULT 'USDT',
      estimated_total_usd TEXT NOT NULL DEFAULT '$0.00',
      assets_title TEXT NOT NULL DEFAULT 'My Assets',
      assets_cta_label TEXT NOT NULL DEFAULT 'View All 350+ Coins',
      recent_transactions_title TEXT NOT NULL DEFAULT 'Recent Transactions',
      recent_transactions_more_label TEXT NOT NULL DEFAULT 'More',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (id = 1)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assets (
      id SERIAL PRIMARY KEY,
      asset_code TEXT NOT NULL,
      asset_name TEXT NOT NULL,
      amount_display TEXT NOT NULL,
      value_display TEXT NOT NULL,
      price_display TEXT NOT NULL,
      action_label TEXT NOT NULL DEFAULT 'Cash In',
      icon_url TEXT,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      transaction_type TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_display TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT '',
      date_label TEXT NOT NULL,
      time_label TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      icon_category TEXT NOT NULL DEFAULT 'transfer',
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO site_settings (
      id,
      estimated_total_value,
      estimated_total_currency,
      estimated_total_usd,
      assets_title,
      assets_cta_label,
      recent_transactions_title,
      recent_transactions_more_label
    )
    VALUES (1, '0.00', 'USDT', '$0.00', 'My Assets', 'View All 350+ Coins', 'Recent Transactions', 'More')
    ON CONFLICT (id) DO NOTHING;
  `);

  const assetCountResult = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM assets');
  if (assetCountResult.rows[0].count === 0) {
    await pool.query(
      `
        INSERT INTO assets (
          asset_code,
          asset_name,
          amount_display,
          value_display,
          price_display,
          action_label,
          icon_url,
          enabled,
          sort_order
        )
        VALUES
          ('BNB', 'BNB', '0.00', '$0.00', '$605.33', 'Cash In', 'https://bin.bnbstatic.com/image/admin_mgs_image_upload/20220218/94863af2-c980-42cf-a139-7b9f462a36c2.png', TRUE, 1),
          ('BTC', 'Bitcoin', '0.00', '$0.00', '$63,066.01', 'Cash In', 'https://bin.bnbstatic.com/image/admin_mgs_image_upload/20201110/87496d50-2408-43e1-ad4c-78b47b448a6a.png', TRUE, 2),
          ('ETH', 'Ethereum', '0.00', '$0.00', '$1,882.30', 'Cash In', 'https://bin.bnbstatic.com/image/admin_mgs_image_upload/20201110/3a8c9fe6-2a76-4ace-aa07-415d994de6f0.png', TRUE, 3),
          ('USDT', 'TetherUS', '0.00', '$0.00', '$1.00', 'Cash In', 'https://bin.bnbstatic.com/image/admin_mgs_image_upload/20240508/6180cdb6-8480-4a3c-a8a9-8a193a89fc5e.png', TRUE, 4);
      `
    );
  }

  const adminCountResult = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM admin_users');
  if (adminCountResult.rows[0].count === 0) {
    if (!ADMIN_PASSWORD) {
      throw new Error('ADMIN_PASSWORD is required to create the initial admin user.');
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await pool.query(
      `
        INSERT INTO admin_users (username, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (username) DO NOTHING;
      `,
      [ADMIN_USERNAME, passwordHash]
    );
  }
}

async function getPublicSettingsPayload() {
  const settingsResult = await pool.query('SELECT * FROM site_settings WHERE id = 1');
  const assetsResult = await pool.query(
    `
      SELECT id, asset_code, asset_name, amount_display, value_display, price_display, action_label, icon_url, enabled, sort_order
      FROM assets
      WHERE enabled = TRUE
      ORDER BY sort_order ASC, id ASC;
    `
  );

  return {
    settings: settingsResult.rows[0],
    assets: assetsResult.rows
  };
}

async function getAdminDashboardPayload() {
  const settingsResult = await pool.query('SELECT * FROM site_settings WHERE id = 1');
  const assetsResult = await pool.query(
    `
      SELECT id, asset_code, asset_name, amount_display, value_display, price_display, action_label, icon_url, enabled, sort_order
      FROM assets
      ORDER BY sort_order ASC, id ASC;
    `
  );
  const transactionsResult = await pool.query(
    `
      SELECT id, transaction_type, description, amount_display, currency, date_label, time_label, status, icon_category, enabled, sort_order
      FROM transactions
      ORDER BY sort_order ASC, id DESC;
    `
  );

  return {
    settings: settingsResult.rows[0],
    assets: assetsResult.rows,
    transactions: transactionsResult.rows
  };
}

function normalizeString(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value).trim();
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function normalizeSortOrder(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Database unavailable' });
  }
});

app.get('/api/settings', async (_req, res) => {
  try {
    const payload = await getPublicSettingsPayload();
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.get('/api/transactions', async (_req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT id, transaction_type, description, amount_display, currency, date_label, time_label, status, icon_category, enabled, sort_order
        FROM transactions
        WHERE enabled = TRUE
        ORDER BY sort_order ASC, id DESC;
      `
    );
    res.json({ transactions: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const username = normalizeString(req.body.username);
    const password = String(req.body.password || '');

    const result = await pool.query(
      'SELECT id, username, password_hash FROM admin_users WHERE username = $1',
      [username]
    );

    const admin = result.rows[0];
    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const matches = await bcrypt.compare(password, admin.password_hash);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signAdminToken(admin);
    setAuthCookie(res, token);

    res.json({
      success: true,
      admin: { id: admin.id, username: admin.username }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({
    admin: {
      id: req.admin.id,
      username: req.admin.username,
      created_at: req.admin.created_at,
      updated_at: req.admin.updated_at
    }
  });
});

app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
  try {
    const payload = await getAdminDashboardPayload();
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const nextValues = {
      estimated_total_value: normalizeString(req.body.estimated_total_value, '0.00'),
      estimated_total_currency: normalizeString(req.body.estimated_total_currency, 'USDT'),
      estimated_total_usd: normalizeString(req.body.estimated_total_usd, '$0.00'),
      assets_title: normalizeString(req.body.assets_title, 'My Assets'),
      assets_cta_label: normalizeString(req.body.assets_cta_label, 'View All 350+ Coins'),
      recent_transactions_title: normalizeString(req.body.recent_transactions_title, 'Recent Transactions'),
      recent_transactions_more_label: normalizeString(req.body.recent_transactions_more_label, 'More')
    };

    await pool.query(
      `
        UPDATE site_settings
        SET
          estimated_total_value = $1,
          estimated_total_currency = $2,
          estimated_total_usd = $3,
          assets_title = $4,
          assets_cta_label = $5,
          recent_transactions_title = $6,
          recent_transactions_more_label = $7,
          updated_at = NOW()
        WHERE id = 1;
      `,
      [
        nextValues.estimated_total_value,
        nextValues.estimated_total_currency,
        nextValues.estimated_total_usd,
        nextValues.assets_title,
        nextValues.assets_cta_label,
        nextValues.recent_transactions_title,
        nextValues.recent_transactions_more_label
      ]
    );

    const payload = await getPublicSettingsPayload();
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.get('/api/admin/assets', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT id, asset_code, asset_name, amount_display, value_display, price_display, action_label, icon_url, enabled, sort_order
        FROM assets
        ORDER BY sort_order ASC, id ASC;
      `
    );
    res.json({ assets: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load assets' });
  }
});

app.post('/api/admin/assets', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO assets (
          asset_code,
          asset_name,
          amount_display,
          value_display,
          price_display,
          action_label,
          icon_url,
          enabled,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, asset_code, asset_name, amount_display, value_display, price_display, action_label, icon_url, enabled, sort_order;
      `,
      [
        normalizeString(req.body.asset_code, 'NEW'),
        normalizeString(req.body.asset_name, 'New Asset'),
        normalizeString(req.body.amount_display, '0.00'),
        normalizeString(req.body.value_display, '$0.00'),
        normalizeString(req.body.price_display, '$0.00'),
        normalizeString(req.body.action_label, 'Cash In'),
        normalizeString(req.body.icon_url, ''),
        normalizeBoolean(req.body.enabled, true),
        normalizeSortOrder(req.body.sort_order, Date.now())
      ]
    );

    res.status(201).json({ asset: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

app.put('/api/admin/assets/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
        UPDATE assets
        SET
          asset_code = $1,
          asset_name = $2,
          amount_display = $3,
          value_display = $4,
          price_display = $5,
          action_label = $6,
          icon_url = $7,
          enabled = $8,
          sort_order = $9,
          updated_at = NOW()
        WHERE id = $10
        RETURNING id, asset_code, asset_name, amount_display, value_display, price_display, action_label, icon_url, enabled, sort_order;
      `,
      [
        normalizeString(req.body.asset_code, 'NEW'),
        normalizeString(req.body.asset_name, 'New Asset'),
        normalizeString(req.body.amount_display, '0.00'),
        normalizeString(req.body.value_display, '$0.00'),
        normalizeString(req.body.price_display, '$0.00'),
        normalizeString(req.body.action_label, 'Cash In'),
        normalizeString(req.body.icon_url, ''),
        normalizeBoolean(req.body.enabled, true),
        normalizeSortOrder(req.body.sort_order, 0),
        Number(req.params.id)
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json({ asset: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

app.put('/api/admin/assets/reorder', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    await client.query('BEGIN');
    for (const item of items) {
      await client.query('UPDATE assets SET sort_order = $1, updated_at = NOW() WHERE id = $2', [
        normalizeSortOrder(item.sort_order, 0),
        Number(item.id)
      ]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Failed to reorder assets' });
  } finally {
    client.release();
  }
});

app.delete('/api/admin/assets/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM assets WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

app.get('/api/admin/transactions', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT id, transaction_type, description, amount_display, currency, date_label, time_label, status, icon_category, enabled, sort_order
        FROM transactions
        ORDER BY sort_order ASC, id DESC;
      `
    );
    res.json({ transactions: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

app.post('/api/admin/transactions', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO transactions (
          transaction_type,
          description,
          amount_display,
          currency,
          date_label,
          time_label,
          status,
          icon_category,
          enabled,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, transaction_type, description, amount_display, currency, date_label, time_label, status, icon_category, enabled, sort_order;
      `,
      [
        normalizeString(req.body.transaction_type, 'Transfer'),
        normalizeString(req.body.description, 'New Transaction'),
        normalizeString(req.body.amount_display, '+ 0.00'),
        normalizeString(req.body.currency, ''),
        normalizeString(req.body.date_label, 'August 16, 2026'),
        normalizeString(req.body.time_label, ''),
        normalizeString(req.body.status, 'Completed'),
        normalizeString(req.body.icon_category, 'transfer'),
        normalizeBoolean(req.body.enabled, true),
        normalizeSortOrder(req.body.sort_order, Date.now())
      ]
    );

    res.status(201).json({ transaction: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

app.put('/api/admin/transactions/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
        UPDATE transactions
        SET
          transaction_type = $1,
          description = $2,
          amount_display = $3,
          currency = $4,
          date_label = $5,
          time_label = $6,
          status = $7,
          icon_category = $8,
          enabled = $9,
          sort_order = $10,
          updated_at = NOW()
        WHERE id = $11
        RETURNING id, transaction_type, description, amount_display, currency, date_label, time_label, status, icon_category, enabled, sort_order;
      `,
      [
        normalizeString(req.body.transaction_type, 'Transfer'),
        normalizeString(req.body.description, 'Transaction'),
        normalizeString(req.body.amount_display, '+ 0.00'),
        normalizeString(req.body.currency, ''),
        normalizeString(req.body.date_label, 'August 16, 2026'),
        normalizeString(req.body.time_label, ''),
        normalizeString(req.body.status, 'Completed'),
        normalizeString(req.body.icon_category, 'transfer'),
        normalizeBoolean(req.body.enabled, true),
        normalizeSortOrder(req.body.sort_order, 0),
        Number(req.params.id)
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ transaction: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

app.put('/api/admin/transactions/reorder', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    await client.query('BEGIN');
    for (const item of items) {
      await client.query(
        'UPDATE transactions SET sort_order = $1, updated_at = NOW() WHERE id = $2',
        [normalizeSortOrder(item.sort_order, 0), Number(item.id)]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Failed to reorder transactions' });
  } finally {
    client.release();
  }
});

app.delete('/api/admin/transactions/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

app.put('/api/admin/account/password', requireAdmin, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash FROM admin_users WHERE id = $1',
      [req.admin.id]
    );
    const admin = result.rows[0];
    const matches = await bcrypt.compare(currentPassword, admin.password_hash);

    if (!matches) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.admin.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(adminDir, 'index.html'));
});

app.get('/', (_req, res) => {
  const template = fs.readFileSync(mainTemplatePath, 'utf8');
  res.type('html').send(`${template}<script src="/main.js" defer></script>`);
});

app.use(express.static(publicDir, { index: false }));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await bootstrapDatabase();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
