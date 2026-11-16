// @ts-nocheck

const SUPABASE_URL = 'https://bxuxjkkmtxarhpteczrf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_247tzVawplIRCgdrb0B5mA_fbijtbF7'; 
const TABLE_NAME = 'products';

let supabaseClient = null;
try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error('Supabase init error:', e);
}

let allProducts = [];

// 1. Новый самый верхний блок + обновленная категория Lazer/Inkjet/FM
const CATEGORY_ORDER = [
  'Task is 50% Done',
  'Endpaper',
  'Tara',
  'BXT',
  'Lazer/Inkjet/FM',
  'Casing-in',
  'Other',
  'Consumables'
];

const CATEGORY_TITLES = {
  'Task is 50% Done': '⏳ Task is 50% Done',
  'Endpaper': '📄 Endpaper',
  'Tara': '📦 Tara',
  'BXT': '📦 BXT',
  'Lazer/Inkjet/FM': '🖨️ Lazer/Inkjet/FM',
  'Casing-in': '📚 Casing-in',
  'Other': '📌 Other',
  'Consumables': '🛠️ Consumables'
};

const CATEGORY_STYLES = {
  'Task is 50% Done': { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-900', badgeBg: 'bg-amber-100 text-amber-800 border-amber-300' },
  'Endpaper': { bg: 'bg-blue-50/50', border: 'border-blue-200', text: 'text-blue-900', badgeBg: 'bg-blue-100 text-blue-800' },
  'Tara': { bg: 'bg-orange-50/50', border: 'border-orange-200', text: 'text-orange-900', badgeBg: 'bg-orange-100 text-orange-800' },
  'BXT': { bg: 'bg-red-50/50', border: 'border-red-200', text: 'text-red-900', badgeBg: 'bg-red-100 text-red-800' },
  'Lazer/Inkjet/FM': { bg: 'bg-purple-50/50', border: 'border-purple-200', text: 'text-purple-900', badgeBg: 'bg-purple-100 text-purple-800' },
  'Casing-in': { bg: 'bg-yellow-50/50', border: 'border-yellow-200', text: 'text-yellow-900', badgeBg: 'bg-yellow-100 text-yellow-800' },
  'Other': { bg: 'bg-stone-50/50', border: 'border-stone-200', text: 'text-stone-900', badgeBg: 'bg-stone-100 text-stone-800' },
  'Consumables': { bg: 'bg-emerald-50/50', border: 'border-emerald-200', text: 'text-emerald-900', badgeBg: 'bg-emerald-100 text-emerald-800' }
};

// Автоматически обновляем выпадающий список категорий в HTML-модалке
function syncCategorySelectOptions() {
  const selectEl = document.getElementById('product-category');
  if (!selectEl) return;

  const currentVal = selectEl.value;
  selectEl.innerHTML = CATEGORY_ORDER.map(cat => 
    `<option value="${cat}">${CATEGORY_TITLES[cat] || cat}</option>`
  ).join('');

  if (currentVal && CATEGORY_ORDER.includes(currentVal)) {
    selectEl.value = currentVal;
  }
}

// Форматирование числа или комбинированной строки (например, "500pcs + 5cm")
function formatQuantityDisplay(val) {
  if (val === null || val === undefined || val === '') return '0';
  const str = String(val).trim();
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return str.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }
  return str;
}

function getFormattedTimestamp() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Синхронизация времени обновления через Supabase (для всех устройств)
async function fetchGlobalLastUpdate() {
  if (!supabaseClient) return;
  const lastUpdateDisplay = document.getElementById('last-update-display');
  if (!lastUpdateDisplay) return;

  try {
    const { data, error } = await supabaseClient
      .from('app_settings')
      .select('last_update_time')
      .eq('id', 1)
      .single();

    if (!error && data && data.last_update_time) {
      lastUpdateDisplay.textContent = `Updated: ${data.last_update_time}`;
      return;
    }

    if (allProducts.length > 0) {
      const dates = allProducts.map(p => p.updated_at).filter(Boolean);
      if (dates.length > 0) {
        lastUpdateDisplay.textContent = `Updated: ${dates[dates.length - 1]}`;
      }
    }
  } catch (err) {
    console.warn('Не удалось получить время обновления:', err);
  }
}

async function saveGlobalLastUpdate(timestampStr) {
  if (!supabaseClient) return;
  const lastUpdateDisplay = document.getElementById('last-update-display');
  if (lastUpdateDisplay) {
    lastUpdateDisplay.textContent = `Updated: ${timestampStr}`;
  }

  try {
    const { error } = await supabaseClient
      .from('app_settings')
      .upsert({ id: 1, last_update_time: timestampStr });

    if (error && allProducts.length > 0) {
      const firstItem = allProducts[0];
      const idField = firstItem.product_id !== undefined ? 'product_id' : 'id';
      const realId = firstItem.product_id !== undefined ? firstItem.product_id : firstItem.id;
      await supabaseClient
        .from(TABLE_NAME)
        .update({ updated_at: timestampStr })
        .eq(idField, realId);
    }
  } catch (err) {
    console.error('Ошибка сохранения времени обновления в Supabase:', err);
  }
}

// ==========================================
// Часть 2: Модальные окна и отрисовка таблиц
// ==========================================
function openAddModal() {
  syncCategorySelectOptions();
  const form = document.getElementById('product-form');
  const editId = document.getElementById('edit-product-id');
  const title = document.getElementById('modal-title');
  const modal = document.getElementById('add-modal');
  const updatedAtSpan = document.getElementById('modal-updated-at');
  const minStockInput = document.getElementById('product-min-stock');

  if (form) form.reset();
  if (editId) editId.value = '';
  if (title) title.textContent = '📦 Add New Product';
  if (updatedAtSpan) updatedAtSpan.textContent = 'Новый товар (дата создастся при сохранении)';
  // Минимум по умолчанию опущен до 0
  if (minStockInput) minStockInput.value = '0';
  if (modal) modal.classList.remove('hidden');
}

function openEditModal(id) {
  syncCategorySelectOptions();
  const item = allProducts.find(p => String(p.id) === String(id) || String(p.product_id) === String(id));
  if (!item) {
    alert('Товар не найден!');
    return;
  }

  document.getElementById('edit-product-id').value = item.id !== undefined ? item.id : item.product_id;
  document.getElementById('product-name').value = item.name || '';
  
  const normalizedCat = item.category === 'Lazer/Inkjet' ? 'Lazer/Inkjet/FM' : (item.category || 'Other');
  document.getElementById('product-category').value = normalizedCat;
  
  document.getElementById('product-size').value = item.size || '';
  document.getElementById('product-quantity').value = item.quantity ?? 0;
  document.getElementById('product-unit').value = item.unit || 'pcs';
  document.getElementById('product-min-stock').value = item.min_stock ?? 0;

  const updatedAtSpan = document.getElementById('modal-updated-at');
  if (updatedAtSpan) {
    updatedAtSpan.textContent = item.updated_at ? `Изменен: ${item.updated_at}` : 'Дата не указана';
  }

  document.getElementById('modal-title').textContent = '✏️ Edit Product';
  document.getElementById('add-modal').classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('add-modal');
  const form = document.getElementById('product-form');
  if (modal) modal.classList.add('hidden');
  if (form) form.reset();
}

async function loadInventory() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error loading:', error.message);
    return;
  }

  allProducts = data || [];
  renderInventory(allProducts);
  await fetchGlobalLastUpdate();
}

function getSortedCategoriesMap(items) {
  const map = {};
  
  // Блок "Task is 50% Done" всегда отображается первым наверху
  map['Task is 50% Done'] = [];

  items.forEach(item => {
    let cat = item.category || 'Other';
    if (cat === 'Lazer/Inkjet') cat = 'Lazer/Inkjet/FM';
    if (!map[cat]) map[cat] = [];
    map[cat].push(item);
  });

  Object.keys(map).forEach(cat => {
    map[cat].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  });

  const sortedKeys = Object.keys(map).sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a);
    const indexB = CATEGORY_ORDER.indexOf(b);
    
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  return { map, sortedKeys };
}

function renderInventory(items) {
  const container = document.getElementById('blocks-container');
  if (!container) return;

  const { map, sortedKeys } = getSortedCategoriesMap(items);
  let htmlOutput = '';
  let globalIndex = 1;

  for (const catKey of sortedKeys) {
    const categoryItems = map[catKey];
    const style = CATEGORY_STYLES[catKey] || CATEGORY_STYLES['Other'];

    htmlOutput += `
      <div class="bg-white rounded-3xl border ${style.border} shadow-sm overflow-hidden mb-6">
        <div class="${style.bg} px-6 py-4 border-b ${style.border} flex justify-between items-center">
          <h2 class="font-black ${style.text} tracking-tight text-base">${CATEGORY_TITLES[catKey] || catKey}</h2>
          <span class="text-xs font-semibold px-3 py-1 rounded-full border ${style.badgeBg}">
            Items: ${categoryItems.length}
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-stone-100 text-stone-400 text-xs uppercase tracking-wider">
                <th class="p-4 font-semibold w-16 text-center">Order</th>
                <th class="p-4 font-semibold w-12 text-center border-r border-stone-100">No.</th>
                <th class="p-4 font-semibold border-r border-stone-100">Name</th>
                <th class="p-4 font-semibold w-32 border-r border-stone-100">Size</th>
                <th class="p-4 font-semibold w-36 text-right border-r border-stone-100">Quantity</th>
                <th class="p-4 font-semibold w-24 border-r border-stone-100">Unit</th>
                <th class="p-4 font-semibold text-right w-40">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100 text-sm">
    `;

    if (categoryItems.length === 0) {
      htmlOutput += `
        <tr>
          <td colspan="7" class="p-5 text-center text-stone-400 text-xs italic">
            Нет позиций в этой категории
          </td>
        </tr>
      `;
    } else {
      categoryItems.forEach(item => {
        const itemId = item.id !== undefined ? item.id : item.product_id;
        const unit = item.unit || 'pcs';
        
        const rawQtyStr = String(item.quantity ?? '0').trim();
        const isPureNumber = /^-?\d+(\.\d+)?$/.test(rawQtyStr);
        const numericQty = isPureNumber ? parseFloat(rawQtyStr) : parseFloat(rawQtyStr);
        
        // Минимум для предупреждения опущен до 0
        const minThreshold = (item.min_stock !== null && item.min_stock !== undefined) ? Number(item.min_stock) : 0;
        const isLowStock = !isNaN(numericQty) && numericQty <= minThreshold;
        const stockTextColor = isLowStock ? 'text-red-600 font-bold' : 'text-stone-900 font-bold';

        const displayQty = formatQuantityDisplay(item.quantity);
        const displayUnit = isPureNumber ? unit : '—';

        const plusMinusButtons = isPureNumber
          ? `<div class="inline-flex rounded-xl overflow-hidden border border-stone-200 mr-1">
               <button type="button" data-action="dec" data-id="${itemId}" class="bg-stone-50 hover:bg-amber-100 text-amber-700 px-2 py-1 text-xs font-semibold border-r border-stone-200 cursor-pointer">-</button>
               <button type="button" data-action="inc" data-id="${itemId}" class="bg-stone-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 text-xs font-semibold cursor-pointer">+</button>
             </div>`
          : '';

        htmlOutput += `
          <tr class="hover:bg-stone-50/80 transition-colors">
            <td class="p-3 text-center">
              <div class="inline-flex flex-col space-y-0.5">
                <button type="button" onclick="moveItemUp('${itemId}')" class="text-stone-400 hover:text-stone-700 text-xs leading-none cursor-pointer" title="Up">▲</button>
                <button type="button" onclick="moveItemDown('${itemId}')" class="text-stone-400 hover:text-stone-700 text-xs leading-none cursor-pointer" title="Down">▼</button>
              </div>
            </td>
            <td class="p-4 text-center font-mono text-xs text-stone-400 border-r border-stone-100">${globalIndex++}</td>
            <td class="p-4 font-semibold text-stone-800 border-r border-stone-100">${item.name || ''}</td>
            <td class="p-4 text-stone-600 border-r border-stone-100">${item.size || '—'}</td>
            <td class="p-4 text-right font-mono ${stockTextColor} border-r border-stone-100 whitespace-nowrap">
              ${displayQty} ${isLowStock ? '⚠️' : ''}
            </td>
            <td class="p-4 text-stone-500 text-xs border-r border-stone-100">${displayUnit}</td>
            <td class="p-4 text-right whitespace-nowrap">
              ${plusMinusButtons}
              <button type="button" data-action="edit" data-id="${itemId}" class="bg-stone-50 hover:bg-amber-50 text-stone-500 hover:text-amber-600 border border-stone-200 px-2 py-1 rounded-xl text-xs cursor-pointer mr-1" title="Edit">✏️</button>
              <button type="button" data-action="delete" data-id="${itemId}" class="bg-stone-50 hover:bg-rose-50 text-stone-500 hover:text-rose-600 border border-stone-200 px-2 py-1 rounded-xl text-xs cursor-pointer" title="Delete">🗑️</button>
            </td>
          </tr>
        `;
      });
    }

    htmlOutput += `
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  container.innerHTML = htmlOutput;
}


// ==========================================
// Часть 3: Стрелочки, +/-, удаление, обновление и сохранение формы
// ==========================================
(window as any).moveItemUp = async function(id) {
  const item = allProducts.find(p => String(p.id) === String(id) || String(p.product_id) === String(id));
  if (!item) return;

  const normalizeCat = (c) => (c === 'Lazer/Inkjet' ? 'Lazer/Inkjet/FM' : (c || 'Other'));
  const targetCat = normalizeCat(item.category);

  const categoryItems = allProducts
    .filter(p => normalizeCat(p.category) === targetCat)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const index = categoryItems.findIndex(p => String(p.id) === String(id) || String(p.product_id) === String(id));
  if (index <= 0) return;

  categoryItems.splice(index, 1);
  categoryItems.splice(index - 1, 0, item);

  categoryItems.forEach((p, idx) => {
    p.sort_order = idx;
  });

  await saveAllCategoryOrder(categoryItems);
};

(window as any).moveItemDown = async function(id) {
  const item = allProducts.find(p => String(p.id) === String(id) || String(p.product_id) === String(id));
  if (!item) return;

  const normalizeCat = (c) => (c === 'Lazer/Inkjet' ? 'Lazer/Inkjet/FM' : (c || 'Other'));
  const targetCat = normalizeCat(item.category);

  const categoryItems = allProducts
    .filter(p => normalizeCat(p.category) === targetCat)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const index = categoryItems.findIndex(p => String(p.id) === String(id) || String(p.product_id) === String(id));
  if (index === -1 || index >= categoryItems.length - 1) return;

  categoryItems.splice(index, 1);
  categoryItems.splice(index + 1, 0, item);

  categoryItems.forEach((p, idx) => {
    p.sort_order = idx;
  });

  await saveAllCategoryOrder(categoryItems);
};

async function saveAllCategoryOrder(categoryItems) {
  if (!supabaseClient) return;

  try {
    for (const it of categoryItems) {
      const idField = it.product_id !== undefined ? 'product_id' : 'id';
      const realId = it.product_id !== undefined ? it.product_id : it.id;

      await supabaseClient
        .from(TABLE_NAME)
        .update({ sort_order: it.sort_order })
        .eq(idField, realId);
    }
  } catch (err) {
    console.error('Ошибка сохранения порядка:', err);
  }

  loadInventory();
}

// Изменение количества (+ / -)
async function updateQty(id, delta) {
  if (!supabaseClient) return;
  const item = allProducts.find(p => String(p.id) === String(id) || String(p.product_id) === String(id));
  if (!item) return;

  const currentQty = parseFloat(item.quantity) || 0;
  const newQty = Math.max(0, Number((currentQty + delta).toFixed(2)));
  const currentTime = getFormattedTimestamp();
  const idField = item.product_id !== undefined ? 'product_id' : 'id';

  const { error } = await supabaseClient
    .from(TABLE_NAME)
    .update({ 
      quantity: newQty,
      updated_at: currentTime 
    })
    .eq(idField, id);

  if (!error) {
    await saveGlobalLastUpdate(currentTime);
    loadInventory();
  }
}

async function deleteProduct(id) {
  if (!confirm('Вы уверены, что хотите удалить этот товар?')) return;
  if (!supabaseClient) return;

  const item = allProducts.find(p => String(p.id) === String(id) || String(p.product_id) === String(id));
  if (!item) return;

  const idField = item.product_id !== undefined ? 'product_id' : 'id';

  const { error } = await supabaseClient
    .from(TABLE_NAME)
    .delete()
    .eq(idField, id);

  if (!error) loadInventory();
}

document.addEventListener('DOMContentLoaded', () => {
  syncCategorySelectOptions();

  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = `📅 ${now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  loadInventory();

  const openBtn = document.getElementById('open-modal-btn');
  if (openBtn) openBtn.addEventListener('click', openAddModal);

  const closeBtn = document.getElementById('close-modal-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  const cancelBtn = document.getElementById('cancel-modal-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  const refreshDateBtn = document.getElementById('refresh-date-btn');
  if (refreshDateBtn) {
    refreshDateBtn.addEventListener('click', () => {
      const nowStr = getFormattedTimestamp();
      document.getElementById('modal-updated-at').textContent = `🕒 Новая дата (сохраните форму): ${nowStr}`;
      document.getElementById('product-form').dataset.forcedTimestamp = nowStr;
    });
  }

  // Глобальная кнопка обновления — сохраняет время в Supabase для всех устройств
  const globalRefreshBtn = document.getElementById('global-refresh-btn');
  if (globalRefreshBtn) {
    globalRefreshBtn.addEventListener('click', async () => {
      globalRefreshBtn.disabled = true;
      globalRefreshBtn.style.opacity = '0.6';

      const nowStr = getFormattedTimestamp();
      await saveGlobalLastUpdate(nowStr);
      await loadInventory();

      globalRefreshBtn.disabled = false;
      globalRefreshBtn.style.opacity = '1';
    });
  }

  const modal = document.getElementById('add-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

   const exportBtn = document.getElementById('export-excel-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (!allProducts || allProducts.length === 0) {
        alert('Нет данных для экспорта!');
        return;
      }

      const { map, sortedKeys } = getSortedCategoriesMap(allProducts);
      let globalIndex = 1;

      // Цвета шапок блоков в Excel под стиль вашего сайта
      const EXCEL_BLOCK_COLORS = {
        'Task is 50% Done': { headerBg: '#fef3c7', headerText: '#78350f', border: '#fcd34d' },
        'Endpaper':         { headerBg: '#dbeafe', headerText: '#1e3a8a', border: '#93c5fd' },
        'Tara':             { headerBg: '#ffedd5', headerText: '#7c2d12', border: '#fdba74' },
        'BXT':              { headerBg: '#fee2e2', headerText: '#7f1d1d', border: '#fca5a5' },
        'Lazer/Inkjet/FM':  { headerBg: '#f3e8ff', headerText: '#581c87', border: '#d8b4fe' },
        'Casing-in':        { headerBg: '#fef9c3', headerText: '#713f12', border: '#fde047' },
        'Other':            { headerBg: '#f5f5f4', headerText: '#1c1917', border: '#d6d3d1' },
        'Consumables':      { headerBg: '#d1fae5', headerText: '#064e3b', border: '#6ee7b7' }
      };

      let blocksHtml = '';

      for (const catKey of sortedKeys) {
        const categoryItems = map[catKey];
        if (categoryItems.length === 0) continue;

        const colors = EXCEL_BLOCK_COLORS[catKey] || EXCEL_BLOCK_COLORS['Other'];

        // Каждый блок — это отдельная самостоятельная таблица с отступом снизу
        blocksHtml += `
          <table border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt; width: 100%; margin-bottom: 20px;">
            <thead>
              <tr>
                <th colspan="6" style="background-color: ${colors.headerBg}; color: ${colors.headerText}; font-size: 12pt; font-weight: bold; text-align: left; padding: 10px; border: 1px solid ${colors.border};">
                  ${catKey} (Items: ${categoryItems.length})
                </th>
              </tr>
              <tr style="background-color: #f5f5f4; color: #57534e; font-weight: bold;">
                <th style="padding: 6px; border: 1px solid #d6d3d1; width: 50px; text-align: center;">No.</th>
                <th style="padding: 6px; border: 1px solid #d6d3d1; width: 320px; text-align: left;">Name</th>
                <th style="padding: 6px; border: 1px solid #d6d3d1; width: 140px; text-align: left;">Size</th>
                <th style="padding: 6px; border: 1px solid #d6d3d1; width: 140px; text-align: right;">Quantity</th>
                <th style="padding: 6px; border: 1px solid #d6d3d1; width: 80px; text-align: center;">Unit</th>
                <th style="padding: 6px; border: 1px solid #d6d3d1; width: 140px; text-align: center;">Updated At</th>
              </tr>
            </thead>
            <tbody>
        `;

        categoryItems.forEach(item => {
          const rawQtyStr = String(item.quantity ?? '0').trim();
          const isPureNumber = /^-?\d+(\.\d+)?$/.test(rawQtyStr);
          const displayUnit = isPureNumber ? (item.unit || 'pcs') : '—';

          // Подсветка красным в Excel, если остаток на минимуме (0 или ниже)
          const numericQty = parseFloat(rawQtyStr);
          const minThreshold = (item.min_stock !== null && item.min_stock !== undefined) ? Number(item.min_stock) : 0;
          const isLowStock = !isNaN(numericQty) && numericQty <= minThreshold;
          const qtyColor = isLowStock ? 'color: #dc2626; background-color: #fef2f2;' : 'color: #1c1917;';

          blocksHtml += `
            <tr>
              <td style="padding: 6px; border: 1px solid #d6d3d1; text-align: center;">${globalIndex++}</td>
              <td style="padding: 6px; border: 1px solid #d6d3d1; font-weight: bold;">${item.name || ''}</td>
              <td style="padding: 6px; border: 1px solid #d6d3d1;">${item.size || '—'}</td>
              <td style="padding: 6px; border: 1px solid #d6d3d1; text-align: right; font-weight: bold; ${qtyColor}">${rawQtyStr}</td>
              <td style="padding: 6px; border: 1px solid #d6d3d1; text-align: center;">${displayUnit}</td>
              <td style="padding: 6px; border: 1px solid #d6d3d1; text-align: center; color: #78716c;">${item.updated_at || ''}</td>
            </tr>
          `;
        });

        blocksHtml += `
            </tbody>
          </table>
          <br/>
        `;
      }

      const excelHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://w3.org">
        <head>
          <meta charset="UTF-8">
          <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Warehouse Inventory</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        </head>
        <body>
          ${blocksHtml}
        </body>
        </html>
      `;

      const blob = new Blob(['\uFEFF' + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `inventory_blocks_${new Date().toISOString().slice(0, 10)}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }



  const container = document.getElementById('blocks-container');
  if (container) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (!action || !id) return;

      if (action === 'edit') openEditModal(id);
      if (action === 'delete') deleteProduct(id);
      if (action === 'inc') updateQty(id, 1);
      if (action === 'dec') updateQty(id, -1);
    });
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (!query) {
        renderInventory(allProducts);
        return;
      }

      const filtered = allProducts.filter(item => 
        (item.name && item.name.toLowerCase().includes(query)) || 
        (item.size && item.size.toLowerCase().includes(query))
      );
      renderInventory(filtered);
    });
  }

  const form = document.getElementById('product-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!supabaseClient) return;

      const editId = document.getElementById('edit-product-id').value;
      const forcedTime = form.dataset.forcedTimestamp;
      const nowStr = forcedTime || getFormattedTimestamp();

      // Поддержка как чисел ("500"), так и комбинированного текста ("500pcs + 5cm")
      const rawQtyInput = document.getElementById('product-quantity').value.trim();
      const normalizedNumberStr = rawQtyInput.replace(',', '.');
      const parsedQuantity = /^-?\d+(\.\d+)?$/.test(normalizedNumberStr)
        ? parseFloat(normalizedNumberStr)
        : (rawQtyInput || '0');
      
      const productData = {
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value,
        size: document.getElementById('product-size').value,
        quantity: parsedQuantity,
        unit: document.getElementById('product-unit').value,
        min_stock: parseFloat(document.getElementById('product-min-stock').value) || 0,
        updated_at: nowStr
      };

      delete form.dataset.forcedTimestamp;

      if (editId) {
        const item = allProducts.find(p => String(p.id) === String(editId) || String(p.product_id) === String(editId));
        const idField = item && item.product_id !== undefined ? 'product_id' : 'id';

        const { error } = await supabaseClient
          .from(TABLE_NAME)
          .update(productData)
          .eq(idField, editId);

        if (error) {
          alert('Ошибка обновления: ' + error.message);
          return;
        }
      } else {
        const category = productData.category;
        const catItems = allProducts.filter(p => (p.category || 'Other') === category);
        const maxSort = catItems.length > 0 ? Math.max(...catItems.map(p => p.sort_order ?? 0)) : -1;
productData.sort_order = maxSort + 1;
const { error } = await supabaseClient
.from(TABLE_NAME)
.insert([productData]);
if (error) {
alert('Ошибка добавления: ' + error.message);
return;
}
}
await saveGlobalLastUpdate(nowStr);
closeModal();
loadInventory();
});
}
});