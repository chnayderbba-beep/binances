const state = {
  admin: null,
  settings: null,
  assets: [],
  transactions: []
};

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const saveStatus = document.getElementById('save-status');
const settingsForm = document.getElementById('settings-form');
const assetsTableBody = document.getElementById('assets-table-body');
const transactionsTableBody = document.getElementById('transactions-table-body');
const assetTemplate = document.getElementById('asset-row-template');
const transactionTemplate = document.getElementById('transaction-row-template');
const passwordForm = document.getElementById('password-form');

function setStatus(message, tone = 'neutral') {
  saveStatus.textContent = message;
  saveStatus.style.color =
    tone === 'error' ? '#ff8e8e' : tone === 'success' ? '#0f1115' : '#f0b90b';
  saveStatus.style.background =
    tone === 'error'
      ? 'rgba(201, 75, 75, 0.16)'
      : tone === 'success'
        ? '#f0b90b'
        : 'rgba(240, 185, 11, 0.1)';
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Request failed');
  }

  return data;
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  dashboardScreen.classList.add('hidden');
}

function showDashboard() {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
}

function updateOverviewCards() {
  document.getElementById('overview-assets-count').textContent = String(state.assets.length);
  document.getElementById('overview-transactions-count').textContent = String(state.transactions.length);
  document.getElementById('overview-total-value').textContent = state.settings?.estimated_total_value || '0.00';
  document.getElementById('admin-username').textContent = state.admin?.username || '';
}

function fillSettingsForm() {
  if (!state.settings) return;
  Object.entries(state.settings).forEach(([key, value]) => {
    const field = settingsForm.elements.namedItem(key);
    if (field) {
      field.value = value ?? '';
    }
  });
}

function renderAssets() {
  assetsTableBody.innerHTML = '';

  state.assets
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id || 0) - Number(b.id || 0))
    .forEach((asset) => {
      const fragment = assetTemplate.content.cloneNode(true);
      const row = fragment.querySelector('tr');
      row.dataset.id = asset.id ?? '';
      row.dataset.tempId = asset.temp_id ?? '';
      for (const [key, value] of Object.entries(asset)) {
        const input = row.querySelector(`[data-field="${key}"]`);
        if (!input) continue;
        if (input.type === 'checkbox') {
          input.checked = Boolean(value);
        } else {
          input.value = value ?? '';
        }
      }
      assetsTableBody.appendChild(fragment);
    });
}

function renderTransactions() {
  transactionsTableBody.innerHTML = '';

  state.transactions
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id || 0) - Number(b.id || 0))
    .forEach((transaction) => {
      const fragment = transactionTemplate.content.cloneNode(true);
      const row = fragment.querySelector('tr');
      row.dataset.id = transaction.id ?? '';
      row.dataset.tempId = transaction.temp_id ?? '';
      for (const [key, value] of Object.entries(transaction)) {
        const input = row.querySelector(`[data-field="${key}"]`);
        if (!input) continue;
        if (input.type === 'checkbox') {
          input.checked = Boolean(value);
        } else {
          input.value = value ?? '';
        }
      }
      transactionsTableBody.appendChild(fragment);
    });
}

function readRowValues(row) {
  const values = {};
  row.querySelectorAll('[data-field]').forEach((field) => {
    values[field.dataset.field] = field.type === 'checkbox' ? field.checked : field.value.trim();
  });
  return values;
}

async function loadDashboard() {
  const [me, dashboard] = await Promise.all([
    apiFetch('/api/admin/me'),
    apiFetch('/api/admin/dashboard')
  ]);

  state.admin = me.admin;
  state.settings = dashboard.settings;
  state.assets = dashboard.assets;
  state.transactions = dashboard.transactions;

  fillSettingsForm();
  renderAssets();
  renderTransactions();
  updateOverviewCards();
  showDashboard();
  setStatus('Loaded', 'success');
}

async function checkSession() {
  try {
    await loadDashboard();
  } catch (error) {
    showLogin();
  }
}

async function saveSettings() {
  setStatus('Saving...');
  const payload = {};
  new FormData(settingsForm).forEach((value, key) => {
    payload[key] = String(value);
  });

  const result = await apiFetch('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  state.settings = result.settings;
  fillSettingsForm();
  updateOverviewCards();
  setStatus('Saved', 'success');
}

function addAssetRow() {
  state.assets.push({
    id: '',
    temp_id: `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    asset_code: 'NEW',
    asset_name: 'New Asset',
    amount_display: '0.00',
    value_display: '$0.00',
    price_display: '$0.00',
    action_label: 'Cash In',
    icon_url: '',
    enabled: true,
    sort_order: state.assets.length + 1
  });
  renderAssets();
  updateOverviewCards();
}

function addTransactionRow() {
  state.transactions.push({
    id: '',
    temp_id: `transaction-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    transaction_type: 'Deposit',
    description: 'New transaction',
    amount_display: '+ 0.00',
    currency: '',
    date_label: 'August 16, 2026',
    time_label: '',
    status: 'Completed',
    icon_category: 'deposit',
    enabled: true,
    sort_order: state.transactions.length + 1
  });
  renderTransactions();
  updateOverviewCards();
}

function moveRow(list, index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= list.length) return list;
  const updated = [...list];
  [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
  return updated.map((item, itemIndex) => ({ ...item, sort_order: itemIndex + 1 }));
}

async function saveAssetRow(row) {
  setStatus('Saving...');
  const payload = readRowValues(row);
  payload.sort_order = Number(payload.sort_order || 0);
  const id = row.dataset.id;
  const tempId = row.dataset.tempId;
  const result = id
    ? await apiFetch(`/api/admin/assets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    : await apiFetch('/api/admin/assets', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

  const savedAsset = result.asset;
  const existingIndex = state.assets.findIndex((item) => String(item.id) === String(savedAsset.id));
  if (existingIndex >= 0) {
    state.assets[existingIndex] = savedAsset;
  } else {
    const tempIndex = state.assets.findIndex(
      (item) => !item.id && item.temp_id === tempId
    );
    if (tempIndex >= 0) {
      state.assets[tempIndex] = savedAsset;
    } else {
      state.assets.push(savedAsset);
    }
  }

  renderAssets();
  updateOverviewCards();
  setStatus('Saved', 'success');
}

async function saveTransactionRow(row) {
  setStatus('Saving...');
  const payload = readRowValues(row);
  payload.sort_order = Number(payload.sort_order || 0);
  const id = row.dataset.id;
  const tempId = row.dataset.tempId;
  const result = id
    ? await apiFetch(`/api/admin/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    : await apiFetch('/api/admin/transactions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

  const savedTransaction = result.transaction;
  const existingIndex = state.transactions.findIndex((item) => String(item.id) === String(savedTransaction.id));
  if (existingIndex >= 0) {
    state.transactions[existingIndex] = savedTransaction;
  } else {
    const tempIndex = state.transactions.findIndex(
      (item) =>
        !item.id &&
        item.temp_id === tempId
    );
    if (tempIndex >= 0) {
      state.transactions[tempIndex] = savedTransaction;
    } else {
      state.transactions.push(savedTransaction);
    }
  }

  renderTransactions();
  updateOverviewCards();
  setStatus('Saved', 'success');
}

async function deleteAssetRow(row) {
  const id = row.dataset.id;
  const tempId = row.dataset.tempId;
  if (!id) {
    state.assets = state.assets.filter((item) => item.temp_id !== tempId);
    renderAssets();
    updateOverviewCards();
    return;
  }
  setStatus('Deleting...');
  await apiFetch(`/api/admin/assets/${id}`, { method: 'DELETE' });
  state.assets = state.assets.filter((item) => String(item.id) !== String(id));
  renderAssets();
  updateOverviewCards();
  setStatus('Deleted', 'success');
}

async function deleteTransactionRow(row) {
  const id = row.dataset.id;
  const tempId = row.dataset.tempId;
  if (!id) {
    state.transactions = state.transactions.filter((item) => item.temp_id !== tempId);
    renderTransactions();
    updateOverviewCards();
    return;
  }
  setStatus('Deleting...');
  await apiFetch(`/api/admin/transactions/${id}`, { method: 'DELETE' });
  state.transactions = state.transactions.filter((item) => String(item.id) !== String(id));
  renderTransactions();
  updateOverviewCards();
  setStatus('Deleted', 'success');
}

async function persistAssetOrder() {
  const items = state.assets.map((asset, index) => ({
    id: asset.id,
    sort_order: index + 1
  })).filter((asset) => asset.id);
  if (items.length) {
    await apiFetch('/api/admin/assets/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items })
    });
  }
}

async function persistTransactionOrder() {
  const items = state.transactions.map((transaction, index) => ({
    id: transaction.id,
    sort_order: index + 1
  })).filter((transaction) => transaction.id);
  if (items.length) {
    await apiFetch('/api/admin/transactions/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items })
    });
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const formData = new FormData(loginForm);
  try {
    await apiFetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: String(formData.get('username') || ''),
        password: String(formData.get('password') || '')
      })
    });
    loginForm.reset();
    await loadDashboard();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

document.getElementById('save-settings-button').addEventListener('click', async () => {
  try {
    await saveSettings();
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

document.getElementById('add-asset-button').addEventListener('click', addAssetRow);
document.getElementById('add-transaction-button').addEventListener('click', addTransactionRow);

assetsTableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const row = button.closest('tr');
  const action = button.dataset.action;
  const index = Array.from(assetsTableBody.children).indexOf(row);

  try {
    if (action === 'save') {
      await saveAssetRow(row);
    } else if (action === 'delete') {
      await deleteAssetRow(row);
    } else if (action === 'move-up' || action === 'move-down') {
      state.assets = moveRow(state.assets, index, action === 'move-up' ? -1 : 1);
      renderAssets();
      await persistAssetOrder();
      setStatus('Order saved', 'success');
    }
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

transactionsTableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const row = button.closest('tr');
  const action = button.dataset.action;
  const index = Array.from(transactionsTableBody.children).indexOf(row);

  try {
    if (action === 'save') {
      await saveTransactionRow(row);
    } else if (action === 'delete') {
      await deleteTransactionRow(row);
    } else if (action === 'move-up' || action === 'move-down') {
      state.transactions = moveRow(state.transactions, index, action === 'move-up' ? -1 : 1);
      renderTransactions();
      await persistTransactionOrder();
      setStatus('Order saved', 'success');
    }
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(passwordForm);
    await apiFetch('/api/admin/account/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: String(formData.get('currentPassword') || ''),
        newPassword: String(formData.get('newPassword') || '')
      })
    });
    passwordForm.reset();
    setStatus('Password updated', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

document.getElementById('logout-button').addEventListener('click', async () => {
  await apiFetch('/api/admin/logout', { method: 'POST' });
  state.admin = null;
  showLogin();
});

checkSession();
