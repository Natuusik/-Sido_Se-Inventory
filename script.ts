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

const CATEGORY_ORDER = ['Endpaper', 'Tara', 'BXT', 'Lazer/Inkjet', 'Casing-in', 'Other', 'Consumables'];
const CATEGORY_TITLES = {
  'Endpaper': '📄 Endpaper',
  'Tara': '📦 Tara',
  'BXT': '📦 BXT',
  'Lazer/Inkjet': '🖨️ Lazer/Inkjet',
  'Casing-in': '📚 Casing-in',
  'Other': '📌 Other',
  'Consumables': '🛠️ Consumables'
};

const CATEGORY_STYLES = {
  'Endpaper': { bg: 'bg-blue-50/50', border: 'border-blue-200', text: 'text-blue-900', badgeBg: 'bg-blue-100 text-blue-800' },
  'Tara': { bg: 'bg-orange-50/50', border: 'border-orange-200', text: 'text-orange-900', badgeBg: 'bg-orange-100 text-orange-800' },
  'BXT': { bg: 'bg-red-50/50', border: 'border-red-200', text: 'text-red-900', badgeBg: 'bg-red-100 text-red-800' },
  'Lazer/Inkjet': { bg: 'bg-purple-50/50', border: 'border-purple-200', text: 'text-purple-900', badgeBg: 'bg-purple-100 text-purple-800' },
  'Casing-in': { bg: 'bg-yellow-50/50', border: 'border-yellow-200', text: 'text-yellow-900', badgeBg: 'bg-yellow-100 text-yellow-800' },
  'Other': { bg: 'bg-stone-50/50', border: 'border-stone-200', text: 'text-stone-900', badgeBg: 'bg-stone-100 text-stone-800' },
  'Consumables': { bg: 'bg-emerald-50/50', border: 'border-emerald-200', text: 'text-emerald-900', badgeBg: 'bg-emerald-100 text-emerald-800' }
};

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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

function openAddModal() {
  const form = document.getElementById('product-form');
  const editId = document.getElementById('edit-product-id');
  const title = document.getElementById('modal-title');
  const modal = document.getElementById('add-modal');
  const updatedAtSpan = document.getElementById('modal-updated-at');

  if (form) form.reset();
  if (editId) editId.value = '';
  if (title) title.textContent = '📦 Add New Product';
  if (updatedAtSpan) updatedAtSpan.textContent = 'Новый товар (дата создастся при сохранении)';
  if (modal) modal.classList.remove('hidden');
}

function openEditModal(id) {
  const item = allProducts.find(p => String(p.id) === String(id) || String(p.product_id) === String(id));
  if (!item) {
    alert('Товар не найден!');
    return;
  }

  document.getElementById('edit-product-id').value = item.id !== undefined ? item.id : item.product_id;
  document.getElementById('product-name').value = item.name || '';
  document.getElementById('product-category').value = item.category || 'Other';
  document.getElementById('product-size').value = item.size || '';
  document.getElementById('product-quantity').value = item.quantity ?? 0;
  document.getElementById('product-unit').value = item.unit || 'pcs';
  document.getElementById('product-min-stock').value = item.min_stock ?? 5;

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
    .order('name', { ascending: true });

  if (error) {
    console.error('Error loading:', error.message);
    return;
  }

  allProducts = data || [];
  renderInventory(allProducts);
}

function getSortedCategoriesMap(items) {
  const map = {};
  items.forEach(item => {
    const cat = item.category || 'Other';
    if (!map[cat]) map[cat] = [];
    map[cat].push(item);
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

  if (items.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-stone-400">Нет данных для отображения</div>`;
    return;
  }

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
                <th class="p-4 font-semibold w-10 text-center">⋮⋮</th>
                <th class="p-4 font-semibold w-12 text-center border-r border-stone-100">No.</th>
                <th class="p-4 font-semibold border-r border-stone-100">Name</th>
                <th class="p-4 font-semibold w-32 border-r border-stone-100">Size</th>
                <th class="p-4 font-semibold w-28 text-right border-r border-stone-100">Quantity</th>
                <th class="p-4 font-semibold w-28 border-r border-stone-100">Unit</th>
                <th class="p-4 font-semibold text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100 text-sm sortable-tbody">
    `;

  categoryItems.forEach(item => {
      const itemId = item.id !== undefined ? item.id : item.product_id;
      const unit = item.unit || 'pcs';
      const isLowStock = !!(item.min_stock !== null && unit === 'pcs' && item.quantity <= item.min_stock);
      const stockTextColor = isLowStock ? 'text-red-600 font-bold' : 'text-stone-900 font-bold';

      // Кнопки изменения (+ / -) для pcs и cm
      let actionButtons = `
        <div class="inline-flex rounded-xl overflow-hidden border border-stone-200">
          <button type="button" data-action="dec" data-id="${itemId}" class="bg-stone-50 hover:bg-amber-100 text-amber-700 px-2 py-1 text-xs font-semibold border-r border-stone-200 cursor-pointer">-</button>
          <button type="button" data-action="inc" data-id="${itemId}" class="bg-stone-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 text-xs font-semibold cursor-pointer">+</button>
        </div>
      `;

      htmlOutput += `
        <tr draggable="true" data-id="${itemId}" class="hover:bg-stone-50/80 transition-colors border-b border-stone-100 cursor-grab active:cursor-grabbing">
          <td class="p-4 text-center text-stone-300 hover:text-stone-600 select-none">⋮⋮</td>
          <td class="p-4 font-bold text-stone-400 w-12 text-center border-r border-stone-100">${globalIndex++}</td>
          <td class="p-4 font-bold text-stone-900 border-r border-stone-100">
            ${item.name}
          </td>
          <td class="p-4 text-stone-700 font-medium w-32 truncate border-r border-stone-100">${item.size || '—'}</td>
          <td class="p-4 w-28 text-right border-r border-stone-100">
            <span class="${stockTextColor} text-sm">
              ${formatNumber(item.quantity)} ${isLowStock ? '⚠️' : ''}
            </span>
          </td>
          <td class="p-4 w-28 border-r border-stone-100">
            <div class="flex items-center justify-between gap-2">
              <span class="text-stone-500 font-medium text-xs">${unit}</span>
              ${actionButtons}
            </div>
          </td>
          <td class="p-4 text-right w-36 space-x-1">
            <button type="button" data-action="edit" data-id="${itemId}" class="bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-stone-200 cursor-pointer">
              ✏️ Edit
            </button>
            <button type="button" data-action="delete" data-id="${itemId}" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-rose-200 shadow-sm cursor-pointer">
              🗑️
            </button>
          </td>
        </tr>
      `;
    });

    htmlOutput += `
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  container.innerHTML = htmlOutput;
  initDragAndDrop();
}

// Логика перетаскивания строк мышкой (Drag & Drop)
function initDragAndDrop() {
  const tbodies = document.querySelectorAll('.sortable-tbody');
  
  tbodies.forEach(tbody => {
    let draggedRow = null;

    tbody.addEventListener('dragstart', (e) => {
      draggedRow = e.target.closest('tr');
      if (draggedRow) {
        draggedRow.classList.add('opacity-40', 'bg-blue-50');
        e.dataTransfer.effectAllowed = 'move';
      }
    });

    tbody.addEventListener('dragend', (e) => {
      if (draggedRow) {
        draggedRow.classList.remove('opacity-40', 'bg-blue-50');
        draggedRow = null;
      }
      // Убираем подсветку со всех строк
      tbody.querySelectorAll('tr').forEach(tr => tr.classList.remove('border-t-2', 'border-blue-500'));
    });

    tbody.addEventListener('dragover', (e) => {
      e.preventDefault();
      const targetRow = e.target.closest('tr');
      if (!targetRow || targetRow === draggedRow) return;

      tbody.querySelectorAll('tr').forEach(tr => tr.classList.remove('border-t-2', 'border-blue-500'));
      targetRow.classList.add('border-t-2', 'border-blue-500');
    });

    tbody.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetRow = e.target.closest('tr');
      if (!targetRow || !draggedRow || targetRow === draggedRow) return;

      // Меняем строки местами в DOM визуально
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const draggedIndex = rows.indexOf(draggedRow);
      const targetIndex = rows.indexOf(targetRow);

      if (draggedIndex < targetIndex) {
        tbody.insertBefore(draggedRow, targetRow.nextSibling);
      } else {
        tbody.insertBefore(draggedRow, targetRow);
      }
    });
  });
}

// Изменение количества (+ / -) с учетом шага (для см можно менять по 1 или добавить логику)
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

  if (!error) loadInventory();
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

  const globalRefreshBtn = document.getElementById('global-refresh-btn');
  const lastUpdateDisplay = document.getElementById('last-update-display');
  const savedLastUpdate = localStorage.getItem('warehouse_last_refresh');
  if (savedLastUpdate && lastUpdateDisplay) {
    lastUpdateDisplay.textContent = `Updated: ${savedLastUpdate}`;
  }

  if (globalRefreshBtn) {
    globalRefreshBtn.addEventListener('click', () => {
      const nowStr = getFormattedTimestamp();
      if (lastUpdateDisplay) {
        lastUpdateDisplay.textContent = `Updated: ${nowStr}`;
      }
      localStorage.setItem('warehouse_last_refresh', nowStr);
      loadInventory();
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
      let csvContent = "\uFEFFNo;Название;Категория;Размер;Количество;Ед. изм.;Мин. остаток;Дата обновления\n";
      let globalIndex = 1;

      for (const catKey of sortedKeys) {
        const categoryItems = map[catKey];
        categoryItems.forEach(item => {
          const row = [
            globalIndex++,
            `"${(item.name || '').replace(/"/g, '""')}"`,
            `"${(item.category || '').replace(/"/g, '""')}"`,
            `"${(item.size || '').replace(/"/g, '""')}"`,
            item.quantity ?? 0,
            `"${(item.unit || 'pcs')}"`,
            item.min_stock ?? 5,
            `"${(item.updated_at || '')}"`
          ];
          csvContent += row.join(";") + "\n";
        });
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `inventory_${new Date().toISOString().slice(0, 10)}.csv`);
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
      
      const productData = {
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value,
        size: document.getElementById('product-size').value,
        quantity: parseFloat(document.getElementById('product-quantity').value.replace(',', '.')) || 0,
        unit: document.getElementById('product-unit').value,
        min_stock: parseFloat(document.getElementById('product-min-stock').value) || 0,
        updated_at: forcedTime || getFormattedTimestamp()
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
        const { error } = await supabaseClient
          .from(TABLE_NAME)
          .insert([productData]);

        if (error) {
          alert('Ошибка добавления: ' + error.message);
          return;
        }
      }

      closeModal();
      loadInventory();
    });
  }
});