import { supabase } from './supabase-client.js';

(function () {
  const S3_BASE = 'https://leutschau-gallery.s3.eu-central-1.amazonaws.com/';
  const container = document.querySelector('[data-lightgallery="group"]');
  const adminContainer = document.getElementById('admin-gallery-controls');
  
  if (!container) return;

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    let isAdmin = false;

    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();
      isAdmin = profile?.is_admin || false;
    }

    if (isAdmin) {
      setupAdminUI();
    }

    loadGallery(isAdmin);
  }

  function setupAdminUI() {
    adminContainer.style.display = 'block';
    adminContainer.innerHTML = `
      <div style="text-align: left; background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #eee;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px;">
            <h4 style="margin: 0; color: #a3734a; font-family: 'Roboto Slab', serif; font-weight: 700; min-width: 200px;">Administrácia Galérie</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="admin-save-all-btn" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold; transition: .3s; white-space: nowrap;">Uložiť zmeny</button>
                <button id="admin-logout-btn" style="background: #f8f9fa; border: 1px solid #ddd; padding: 10px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; color: #666; white-space: nowrap;">Odhlásiť sa</button>
            </div>
        </div>
        
        <div style="background: #fcfcfc; padding: 20px; border-radius: 10px; border: 1px solid #eaeaea;">
            <p style="font-size: 0.9rem; margin-bottom: 15px; color: #444; font-weight: bold;">Pridať nové fotky (aj viac naraz):</p>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: center; margin-bottom: 15px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                  <label for="admin-file-input" style="background: #a3734a; color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold; transition: .2s;">+ Zvoliť fotky</label>
                  <input type="file" id="admin-file-input" accept="image/*" multiple style="display:none;">
              </div>
              <input type="text" id="admin-alt-input" placeholder="Spoločný popis (voliteľné)" style="padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; flex-grow: 1; font-size: 0.9rem;">
              <button id="admin-upload-btn" style="background: #007bff; color: white; border: none; padding: 11px 30px; border-radius: 6px; cursor: pointer; font-weight: bold; display: none;">Nahrať všetko</button>
            </div>
            
            <!-- Preview Section -->
            <div id="admin-preview-container" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;"></div>
            
            <div id="admin-upload-status" style="margin-top: 15px; font-size: 0.85rem; font-weight: bold; color: #666;"></div>
        </div>
      </div>
    `;

    const fileInput = document.getElementById('admin-file-input');
    const previewContainer = document.getElementById('admin-preview-container');
    const uploadBtn = document.getElementById('admin-upload-btn');
    const status = document.getElementById('admin-upload-status');

    fileInput.onchange = (e) => {
        const files = Array.from(e.target.files);
        previewContainer.innerHTML = '';
        
        if (files.length > 0) {
            uploadBtn.style.display = 'block';
            uploadBtn.innerText = files.length > 1 ? `Nahrať všetko (${files.length})` : 'Nahrať fotku';
            
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (re) => {
                    const imgWrap = document.createElement('div');
                    imgWrap.style.cssText = 'width: 80px; height: 80px; border-radius: 6px; overflow: hidden; border: 2px solid #ddd; position: relative;';
                    imgWrap.innerHTML = `<img src="${re.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    previewContainer.appendChild(imgWrap);
                };
                reader.readAsDataURL(file);
            });
        } else {
            uploadBtn.style.display = 'none';
        }
    }

    document.getElementById('admin-logout-btn').onclick = async () => {
        if(confirm('Naozaj sa chcete odhlásiť?')) {
            await supabase.auth.signOut();
            location.reload();
        }
    };

    document.getElementById('admin-save-all-btn').onclick = async () => {
        const btn = document.getElementById('admin-save-all-btn');
        btn.disabled = true;
        btn.innerText = 'Ukladám...';
        const items = Array.from(document.querySelectorAll('.gallery-item-wrap'));
        let updates = items.map(el => ({
            id: el.dataset.id,
            alt_text: el.querySelector('.admin-alt-edit').value,
            requested_sort: parseFloat(el.querySelector('.admin-sort-edit').value) || 999
        }));
        updates.sort((a, b) => a.requested_sort - b.requested_sort);
        for (let i = 0; i < updates.length; i++) {
            await supabase.from('gallery_items').update({ alt_text: updates[i].alt_text, sort_order: i }).eq('id', updates[i].id);
        }
        location.reload();
    };

    uploadBtn.onclick = async () => {
      const files = Array.from(fileInput.files);
      const alt = document.getElementById('admin-alt-input').value;
      
      uploadBtn.disabled = true;
      let completed = 0;

      for (const file of files) {
          status.innerText = `Nahrávam ${completed + 1} z ${files.length}: ${file.name}...`;
          try {
              const { data, error: signErr } = await supabase.functions.invoke('s3-manager', {
                  body: { action: 'sign', fileName: file.name, contentType: file.type }
              });
              if (signErr) throw signErr;

              const uploadRes = await fetch(data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
              if (!uploadRes.ok) {
                  const errBody = await uploadRes.text();
                  console.error('S3 Error Body:', errBody);
                  throw new Error(`S3 upload zlyhal (${uploadRes.status}): ${errBody.substring(0, 50)}...`);
              }

        const { error: dbErr } = await supabase.from('gallery_items').insert({
          s3_key: data.key, 
          alt_text: alt, 
          mime_type: file.type, 
          file_size: file.size, 
          sort_order: -Math.floor(Date.now() / 1000) + completed, // New items at the top
          is_active: true // Force active status
        });

        if (dbErr) throw dbErr;
              completed++;
          } catch (err) {
              console.error(err);
              status.style.color = 'red';
              status.innerText = `Chyba pri ${file.name}: ${err.message}`;
              return;
          }
      }

      status.style.color = 'green';
      status.innerText = `Úspešne nahraných ${completed} fotiek! Obnovujem...`;
      setTimeout(() => location.reload(), 1500);
    };
  }

  async function loadGallery(isAdmin) {
    const { data: photos, error } = await supabase
      .from('gallery_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) return;

    let currentOrder = photos.map(p => p.id);

    function renderItems() {
        container.innerHTML = '';
        currentOrder.forEach((id, index) => {
            const photo = photos.find(p => p.id === id);
            const fullUrl = S3_BASE + photo.s3_key;
            const col = document.createElement('div');
            col.className = 'col-sm-10 col-md-6';
            
            let adminControls = '';
            if (isAdmin) {
                adminControls = `
                <div style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <div style="display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-end;">
                        <div style="flex-grow: 1;">
                            <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">Popis (Alt)</label>
                            <input type="text" class="admin-alt-edit" value="${photo.alt_text || ''}" 
                                style="width: 100%; padding: 8px 12px; font-size: 0.9rem; border: 1px solid #ccc; border-radius: 5px;">
                        </div>
                        <div style="width: 80px;">
                            <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">Poradie</label>
                            <input type="number" class="admin-sort-edit" data-id="${photo.id}" value="${index + 1}" 
                                step="1" min="1" max="${currentOrder.length}"
                                style="width: 100%; padding: 8px 5px; font-size: 1rem; border: 1px solid #ccc; border-radius: 5px; text-align: center; font-weight: bold;">
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <button class="admin-del-btn" data-id="${photo.id}" data-key="${photo.s3_key}" 
                                style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 5px; margin-left: auto;">
                            <span class="mdi mdi-delete-outline"></span> Zmazať
                        </button>
                    </div>
                </div>
                `;
            }

            col.innerHTML = `
                <div class="gallery-item-wrap" data-id="${photo.id}" style="margin-bottom: 50px;">
                <a class="thumbnail-rayen thumbnail-md" data-lightgallery="item" href="${fullUrl}">
                    <figure style="border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <img width="460" height="345" src="${fullUrl}" alt="${photo.alt_text || ''}">
                    <figcaption><span class="icon icon-white mdi mdi-magnify-plus"></span></figcaption>
                    </figure>
                </a>
                ${adminControls}
                </div>`;
            container.appendChild(col);
        });

        if (isAdmin) {
            document.querySelectorAll('.admin-sort-edit').forEach(input => {
                input.onchange = (e) => {
                    const id = e.target.dataset.id;
                    const newPos = parseInt(e.target.value) - 1;
                    const oldPos = currentOrder.indexOf(id);
                    if (newPos >= 0 && newPos < currentOrder.length && newPos !== oldPos) {
                        const [movedId] = currentOrder.splice(oldPos, 1);
                        currentOrder.splice(newPos, 0, movedId);
                        renderItems();
                    } else { e.target.value = oldPos + 1; }
                };
            });
            document.querySelectorAll('.admin-del-btn').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Naozaj zmazať?')) return;
                    btn.disabled = true;
                    await supabase.from('gallery_items').update({ is_active: false }).eq('id', btn.dataset.id);
                    await supabase.functions.invoke('s3-manager', { body: { action: 'delete', s3Key: btn.dataset.key } });
                    await supabase.from('gallery_items').delete().eq('id', btn.dataset.id);
                    location.reload();
                };
            });
        }

        if (window.jQuery && jQuery.fn.lightGallery) {
          const $lg = jQuery(container);
          if ($lg.data('lightGallery')) $lg.data('lightGallery').destroy(true);
          $lg.lightGallery({ selector: '[data-lightgallery="item"]' });
        }
    }

    renderItems();
  }

  init();
})();
