(function () {
  const REFRESH_INTERVAL_MS = 15000;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function findElementByExactText(text, selectors = 'div,span,p,button') {
    return Array.from(document.querySelectorAll(selectors)).find((element) => {
      const normalized = element.textContent.replace(/\s+/g, ' ').trim();
      return normalized === text;
    });
  }

  function getOverviewContainer() {
    const currencyElement = document.getElementById('wallet-switch-balance-quote-asset');
    return currencyElement ? currencyElement.closest('.text-t-primary') : null;
  }

  function updateOverview(settings) {
    const container = getOverviewContainer();
    if (!container) return;

    const amountElement = container.querySelector('.typography-Headline4');
    const currencyElement = document.getElementById('wallet-switch-balance-quote-asset');
    const usdElement = container.querySelector('.body3.mt-2');

    if (amountElement) amountElement.textContent = settings.estimated_total_value;
    if (currencyElement) currencyElement.textContent = settings.estimated_total_currency;
    if (usdElement) usdElement.textContent = `≈ ${settings.estimated_total_usd}`;
  }

  function getAssetsContainer() {
    const header = document.getElementById('asset-table-list-asset');
    return header ? header.closest('.mt-xl.flex.flex-col.justify-between.rounded-xl.border.border-solid.border-Line.p-xl') : null;
  }

  function updateAssetsHeader(settings) {
    const assetsContainer = getAssetsContainer();
    if (!assetsContainer) return;

    const titleElement = assetsContainer.querySelector('.subtitle1.pc\\:headline6');
    const ctaElement = assetsContainer.querySelector('#btn-HeadTitle-handleClick .subtitle4');

    if (titleElement) titleElement.textContent = settings.assets_title;
    if (ctaElement) ctaElement.textContent = settings.assets_cta_label;
  }

  function renderAssets(assets) {
    const assetsContainer = getAssetsContainer();
    if (!assetsContainer) return;

    const rowContainer = assetsContainer.querySelector('.pc-coin-view');
    if (!rowContainer) return;

    rowContainer.innerHTML = assets
      .map((asset) => {
        const actionId = `btn-BuyAction-cash-in-${escapeHtml(asset.asset_code)}`;
        const iconUrl = asset.icon_url || '';
        return `
          <div class="-mx-s flex h-[64px] rounded-m px-s py-[8px] hover:bg-bg2 cursor-pointer flex-wrap">
            <div class="flex w-2/5 items-center pr-4 last-of-type:pr-0 justify-start">
              <div class="flex items-center">
                <div class="relative h-[24px] w-[24px]">
                  <img
                    alt="${escapeHtml(asset.asset_code)}"
                    aria-label="${escapeHtml(asset.asset_code)}"
                    class="bn-lazy-img data-round data-lazy-load h-full w-full"
                    src="${escapeHtml(iconUrl)}"
                    style="background-color:transparent"
                  />
                </div>
                <div class="ml-2xs min-w-0 flex-1">
                  <div class="subtitle3">${escapeHtml(asset.asset_code)}</div>
                  <div class="bn-tooltips-wrap bn-tooltips-web">
                    <div class="bn-tooltips-ele !block truncate max-w-[200px] body3 text-t-Tertiary">
                      ${escapeHtml(asset.asset_name)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex w-1/5 items-center pr-4 last-of-type:pr-0 justify-end">
              <div class="text-right">
                <div class="body2">${escapeHtml(asset.amount_display)}</div>
                <div class="body3 text-t-Tertiary">${escapeHtml(asset.value_display)}</div>
              </div>
            </div>
            <div class="flex w-1/5 items-center pr-4 last-of-type:pr-0 justify-end">
              <div class="-mr-4xs text-right">
                <div class="body2">${escapeHtml(asset.price_display)}</div>
              </div>
            </div>
            <div class="flex w-1/5 items-center pr-4 last-of-type:pr-0 justify-end">
              <div class="bn-flex items-center">
                <div class="body3 cursor-pointer text-right underline hover:text-PrimaryYellow" id="${actionId}">
                  ${escapeHtml(asset.action_label)}
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function iconSvg(category) {
    if (category === 'deposit') {
      return `
        <svg class="bn-svg text-[20px]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3a1 1 0 011 1v8.586l2.293-2.293a1 1 0 111.414 1.414l-4.004 4.004a1 1 0 01-1.414 0L7.285 11.707A1 1 0 118.7 10.293L11 12.586V4a1 1 0 011-1zM5 18a1 1 0 011-1h12a1 1 0 110 2H6a1 1 0 01-1-1z" fill="currentColor"></path>
        </svg>
      `;
    }

    if (category === 'withdraw') {
      return `
        <svg class="bn-svg text-[20px]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21a1 1 0 01-1-1v-8.586l-2.293 2.293a1 1 0 11-1.414-1.414l4.004-4.004a1 1 0 011.414 0l4.004 4.004a1 1 0 11-1.414 1.414L13 11.414V20a1 1 0 01-1 1zM5 6a1 1 0 011-1h12a1 1 0 110 2H6A1 1 0 015 6z" fill="currentColor"></path>
        </svg>
      `;
    }

    return `
      <svg class="bn-svg text-[20px]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 7a1 1 0 011.707-.707L12 9.586l3.293-3.293A1 1 0 0117 7v10a1 1 0 11-2 0V9.414l-2.293 2.293a1 1 0 01-1.414 0L9 9.414V17a1 1 0 11-2 0V7z" fill="currentColor"></path>
      </svg>
    `;
  }

  function renderEmptyTransactions(section) {
    section.innerHTML = `
      <div class="flex flex-col items-center text-t-Tertiary py-5xl pc:py-m">
        <svg class="bn-svg text-[72px]" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
          <path d="M72.957 8.873a4.93 4.93 0 014.93 4.93V60.82h-1.972V13.803a2.958 2.958 0 00-2.958-2.958H21.689a2.958 2.958 0 00-2.957 2.958v67.042a2.958 2.958 0 002.957 2.958h48.434v1.972H21.69a4.93 4.93 0 01-4.93-4.93V13.803a4.93 4.93 0 014.93-4.93h51.268z" fill="var(--color-DisableText, currentColor)"></path>
          <path d="M59.647 55.211a.986.986 0 110 1.972H31.55a.986.986 0 110-1.972h28.098z" fill="var(--color-DisableText, currentColor)"></path>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M61.82 21.7c.995.101 1.77.94 1.77 1.962V43.38c0 1.021-.775 1.86-1.77 1.961l-.201.01H33.027a1.972 1.972 0 01-1.96-1.77l-.012-.2V23.66c0-1.088.883-1.971 1.972-1.971H61.62l.201.01zM33.027 43.38H61.62V23.662H33.027V43.38zM70.986 55.21c8.712 0 15.774 7.063 15.774 15.776 0 8.712-7.062 15.774-15.774 15.774S55.21 79.697 55.21 70.986c0-8.713 7.063-15.775 15.775-15.775zm0 22.184a1.725 1.725 0 100 3.45 1.725 1.725 0 000-3.45zm0-16.268c-.817 0-1.48.663-1.48 1.48V73.45a1.48 1.48 0 002.959 0V62.605c0-.816-.663-1.479-1.48-1.479z" fill="var(--color-DisableText, currentColor)"></path>
        </svg>
        <div class="body3 mt-4xs pc:mt-2xs">No records</div>
      </div>
    `;
  }

  function renderTransactions(transactions, settings) {
    const wrapper = document.getElementById('wallet-recent-transactions');
    if (!wrapper) return;

    const titleElement = wrapper.querySelector('.subtitle1');
    const moreElement = wrapper.querySelector('#wallet-recent-transactions-view-more .subtitle4');
    if (titleElement) titleElement.textContent = settings.recent_transactions_title;
    if (moreElement) moreElement.textContent = settings.recent_transactions_more_label;

    const currentBody = wrapper.children[1];
    if (!currentBody) return;

    if (!transactions.length) {
      renderEmptyTransactions(currentBody);
      return;
    }

    currentBody.className = 'flex flex-col';
    currentBody.innerHTML = transactions
      .map((transaction, index) => {
        const statusClass =
          transaction.status.toLowerCase() === 'completed'
            ? 'text-Success'
            : transaction.status.toLowerCase() === 'pending'
              ? 'text-PrimaryYellow'
              : 'text-Error';

        return `
          <div class="flex items-center justify-between py-m ${index !== transactions.length - 1 ? 'border-b border-Line' : ''}">
            <div class="flex items-center min-w-0 pr-m">
              <div class="mr-s flex h-[40px] w-[40px] items-center justify-center rounded-full bg-bg3 text-t-primary">
                ${iconSvg(String(transaction.icon_category || '').toLowerCase())}
              </div>
              <div class="min-w-0">
                <div class="subtitle3 text-t-primary">${escapeHtml(transaction.transaction_type)}</div>
                <div class="body3 text-t-Tertiary truncate">${escapeHtml(transaction.description)}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="subtitle3 text-t-primary">${escapeHtml(transaction.amount_display)}</div>
              <div class="body3 text-t-Tertiary">${escapeHtml(transaction.date_label)}${transaction.time_label ? ` · ${escapeHtml(transaction.time_label)}` : ''}</div>
              <div class="body3 ${statusClass}">${escapeHtml(transaction.status)}</div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  async function loadData() {
    const [settingsResponse, transactionsResponse] = await Promise.all([
      fetch('/api/settings', { credentials: 'same-origin' }),
      fetch('/api/transactions', { credentials: 'same-origin' })
    ]);

    if (!settingsResponse.ok || !transactionsResponse.ok) {
      throw new Error('Failed to load live wallet data');
    }

    const settingsPayload = await settingsResponse.json();
    const transactionsPayload = await transactionsResponse.json();

    updateOverview(settingsPayload.settings);
    updateAssetsHeader(settingsPayload.settings);
    renderAssets(settingsPayload.assets);
    renderTransactions(transactionsPayload.transactions || [], settingsPayload.settings);
  }

  async function refreshData() {
    try {
      await loadData();
    } catch (error) {
      console.error(error);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    refreshData();
    window.setInterval(refreshData, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    });
  });
})();
