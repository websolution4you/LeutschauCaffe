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
      <div style="text-align: left; background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h4 style="margin: 0; color: #a3734a; font-family: 'Roboto Slab', serif;">Správa Galérie</h4>
            <button id="admin-logout-btn" style="background: transparent; border: 1px solid #ddd; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Odhlásiť sa</button>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; background: #f9f9f9; padding: 15px; border-radius: 8px;">
          <input type="file" id="admin-file-input" accept="image/*" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; flex-grow: 1; background: white;">
          <input type="text" id="admin-alt-input" placeholder="Popis fotky (Alt text)" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; flex-grow: 1;">
          <button id="admin-upload-btn" style="background: #a3734a; color: white; border: none; padding: 10px 25px; border-radius: 4px; cursor: pointer; font-weight: bold;">Nahrať fotku</button>
        </div>
        <div id="admin-upload-status" style="margin-top: 10px; font-size: 0.9rem;"></div>
      </div>
    `;

    document.getElementById('admin-logout-btn').onclick = async () => {
        await supabase.auth.signOut();
        location.reload();
    };

    document.getElementById('admin-upload-btn').onclick = async () => {
      const btn = document.getElementById('admin-upload-btn');
      const file = document.getElementById('admin-file-input').files[0];
      const alt = document.getElementById('admin-alt-input').value;
      const status = document.getElementById('admin-upload-status');

      if (!file) return alert('Vyberte súbor');

      btn.disabled = true;
      status.style.color = '#666';
      status.innerText = 'Pripravujem upload...';

      try {
        const { data, error: signErr } = await supabase.functions.invoke('s3-manager', {
          body: { action: 'sign', fileName: file.name, contentType: file.type }
        });

        if (signErr) throw signErr;

        status.innerText = 'Nahrávam do S3...';
        const uploadRes = await fetch(data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        if (!uploadRes.ok) throw new Error('S3 upload zlyhal');

        status.innerText = 'Ukladám metadáta...';
        const { error: dbErr } = await supabase.from('gallery_items').insert({
          s3_key: data.key,
          alt_text: alt,
          mime_type: file.type,
          file_size: file.size
        });

        if (dbErr) throw dbErr;

        status.style.color = 'green';
        status.innerText = 'Úspešne pridané!';
        setTimeout(() => location.reload(), 1000);
      } catch (err) {
        status.style.color = 'red';
        status.innerText = 'Chyba: ' + err.message;
        btn.disabled = false;
      }
    };
  }

  async function loadGallery(isAdmin) {
    const { data: photos, error } = await supabase
      .from('gallery_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Chyba pri načítaní galérie:', error);
      return;
    }

    container.innerHTML = '';
    photos.forEach(photo => {
      const fullUrl = S3_BASE + photo.s3_key;
      const col = document.createElement('div');
      col.className = 'col-sm-10 col-md-6';
      
      let adminControls = '';
      if (isAdmin) {
        adminControls = `
          <div style="margin-top: 15px; background: #f9f9f9; padding: 12px; border-radius: 8px; border: 1px solid #eee;">
            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                <div style="flex-grow: 1;">
                    <label style="font-size: 0.7rem; color: #888; display: block; margin-bottom: 2px;">Alt text</label>
                    <input type="text" class="admin-alt-edit" data-id="${photo.id}" value="${photo.alt_text || ''}" 
                           style="width: 100%; padding: 4px 8px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 3px;">
                </div>
                <div style="width: 60px;">
                    <label style="font-size: 0.7rem; color: #888; display: block; margin-bottom: 2px;">Poradie</label>
                    <input type="number" class="admin-sort-edit" data-id="${photo.id}" value="${photo.sort_order || 0}" 
                           style="width: 100%; padding: 4px 5px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 3px; text-align: center;">
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 5px;">
                <button class="admin-save-btn" data-id="${photo.id}" 
                        style="background: #28a745; color: white; border: none; padding: 4px 12px; border-radius: 3px; cursor: pointer; font-size: 0.75rem; flex-grow: 1;">Uložiť</button>
                <button class="admin-del-btn" data-id="${photo.id}" data-key="${photo.s3_key}" 
                        style="background: #dc3545; color: white; border: none; padding: 4px 12px; border-radius: 3px; cursor: pointer; font-size: 0.75rem;">Zmazať</button>
            </div>
          </div>
        `;
      }

      col.innerHTML = `
        <div class="gallery-item-wrap" style="margin-bottom: 30px;">
          <a class="thumbnail-rayen thumbnail-md" data-lightgallery="item" href="${fullUrl}">
            <figure>
              <img width="460" height="345" src="${fullUrl}" alt="${photo.alt_text || ''}">
              <figcaption><span class="icon icon-white mdi mdi-magnify-plus"></span></figcaption>
            </figure>
          </a>
          ${adminControls}
        </div>`;
      container.appendChild(col);
    });

    if (isAdmin) {
      // SAVE HANDLER
      document.querySelectorAll('.admin-save-btn').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          const alt = document.querySelector(`.admin-alt-edit[data-id="${id}"]`).value;
          const sort = parseInt(document.querySelector(`.admin-sort-edit[data-id="${id}"]`).value);
          
          btn.disabled = true;
          btn.innerText = '...';

          const { error: updErr } = await supabase.from('gallery_items').update({
            alt_text: alt,
            sort_order: sort
          }).eq('id', id);

          if (updErr) {
            alert('Chyba: ' + updErr.message);
            btn.disabled = false;
            btn.innerText = 'Uložiť';
          } else {
            btn.style.background = '#007bff';
            btn.innerText = 'Dobre!';
            setTimeout(() => {
                btn.style.background = '#28a745';
                btn.innerText = 'Uložiť';
                btn.disabled = false;
            }, 1000);
          }
        };
      });

      // DELETE HANDLER
      document.querySelectorAll('.admin-del-btn').forEach(btn => {
        btn.onclick = async (e) => {
          e.preventDefault();
          if (!confirm('Naozaj zmazať túto fotku?')) return;
          
          btn.disabled = true;
          btn.innerText = '...';
          const id = btn.dataset.id;
          const key = btn.dataset.key;

          const { error: softErr } = await supabase.from('gallery_items').update({ is_active: false }).eq('id', id);
          if (softErr) return alert(softErr.message);

          await supabase.functions.invoke('s3-manager', { body: { action: 'delete', s3Key: key } });
          await supabase.from('gallery_items').delete().eq('id', id);
          
          location.reload();
        };
      });
    }

    // Re-init LightGallery
    if (window.jQuery && jQuery.fn.lightGallery) {
      const $lg = jQuery(container);
      if ($lg.data('lightGallery')) $lg.data('lightGallery').destroy(true);
      $lg.lightGallery({ selector: '[data-lightgallery="item"]' });
    }
  }

  init();
})();
