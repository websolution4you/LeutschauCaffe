import { supabase } from './supabase-client.js';

(function () {
  const S3_BASE = 'https://leutschau-gallery.s3.eu-central-1.amazonaws.com/';
  const container = document.querySelector('.blog-classic-wrap');
  const adminContainer = document.createElement('div');
  adminContainer.id = 'admin-news-controls';
  adminContainer.style.display = 'none';
  adminContainer.className = 'offset-bottom-45';
  
  if (!container) return;
  container.parentNode.insertBefore(adminContainer, container);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    let isAdmin = false;

    if (session) {
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
      isAdmin = profile?.is_admin || false;
    }

    if (isAdmin) setupAdminUI();
    loadNews(isAdmin);
  }

  function setupAdminUI() {
    adminContainer.style.display = 'block';
    adminContainer.innerHTML = `
      <div style="text-align: left; background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #eee; margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
            <h4 style="margin: 0; color: #a3734a; font-family: 'Roboto Slab', serif; font-weight: 700;">Administrácia Noviniek</h4>
            <div style="display: flex; gap: 12px;">
                <button id="admin-save-all-btn" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 0.95rem; font-weight: bold;">Uložiť poradie a zmeny</button>
                <button id="admin-logout-btn" style="background: #f8f9fa; border: 1px solid #ddd; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: #666;">Odhlásiť sa</button>
            </div>
        </div>
        
        <div style="background: #fcfcfc; padding: 20px; border-radius: 10px; border: 1px solid #eaeaea;">
            <p style="font-size: 0.9rem; margin-bottom: 15px; color: #444; font-weight: bold;">Pridať novú novinku:</p>
            <div style="display: flex; flex-direction: column; gap: 15px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                  <label for="admin-file-input" style="background: #a3734a; color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold;">+ Zvoliť obrázok/plagát</label>
                  <input type="file" id="admin-file-input" accept="image/*" style="display:none;">
                  <div id="admin-preview-container"></div>
              </div>
              <input type="text" id="admin-title-input" placeholder="Nadpis novinky" style="padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem;">
              <textarea id="admin-desc-input" placeholder="Sprievodný text" style="padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; min-height: 100px;"></textarea>
              <button id="admin-upload-btn" style="background: #007bff; color: white; border: none; padding: 11px 30px; border-radius: 6px; cursor: pointer; font-weight: bold; display: none;">Pridať novinku</button>
            </div>
            <div id="admin-upload-status" style="margin-top: 15px; font-size: 0.85rem; font-weight: bold; color: #666;"></div>
        </div>
      </div>
    `;

    const fileInput = document.getElementById('admin-file-input');
    const previewContainer = document.getElementById('admin-preview-container');
    const uploadBtn = document.getElementById('admin-upload-btn');
    const status = document.getElementById('admin-upload-status');

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        previewContainer.innerHTML = '';
        if (file) {
            uploadBtn.style.display = 'block';
            const reader = new FileReader();
            reader.onload = (re) => {
                previewContainer.innerHTML = `<img src="${re.target.result}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 2px solid #ddd;">`;
            };
            reader.readAsDataURL(file);
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
        const items = Array.from(document.querySelectorAll('.news-item-wrap'));
        let updates = items.map(el => ({
            id: el.dataset.id,
            title: el.querySelector('.admin-title-edit').value,
            description: el.querySelector('.admin-desc-edit').value,
            requested_sort: parseFloat(el.querySelector('.admin-sort-edit').value) || 999
        }));
        updates.sort((a, b) => a.requested_sort - b.requested_sort);
        for (let i = 0; i < updates.length; i++) {
            await supabase.from('news_items').update({ 
                title: updates[i].title, 
                description: updates[i].description, 
                sort_order: i 
            }).eq('id', updates[i].id);
        }
        location.reload();
    };

    uploadBtn.onclick = async () => {
      const file = fileInput.files[0];
      const title = document.getElementById('admin-title-input').value;
      const desc = document.getElementById('admin-desc-input').value;
      
      if (!title) { alert('Prosím zadajte nadpis'); return; }
      
      uploadBtn.disabled = true;
      status.innerText = `Nahrávam: ${file.name}...`;

      try {
          const { data, error: signErr } = await supabase.functions.invoke('s3-manager', {
              body: { action: 'sign', fileName: file.name, contentType: file.type, folder: 'news' }
          });
          if (signErr) throw signErr;

          const uploadRes = await fetch(data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
          if (!uploadRes.ok) throw new Error('S3 upload zlyhal');

          const { error: dbErr } = await supabase.from('news_items').insert({
              s3_key: data.key, 
              title: title,
              description: desc,
              mime_type: file.type, 
              file_size: file.size, 
              sort_order: -Math.floor(Date.now() / 1000)
          });

          if (dbErr) throw dbErr;
          status.style.color = 'green';
          status.innerText = `Novinka úspešne pridaná!`;
          setTimeout(() => location.reload(), 1000);
      } catch (err) {
          console.error(err);
          status.style.color = 'red';
          status.innerText = `Chyba: ${err.message}`;
          uploadBtn.disabled = false;
      }
    };
  }

  async function loadNews(isAdmin) {
    const { data: news, error } = await supabase
      .from('news_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
        console.error("Error loading news:", error);
        return;
    }

    if (news.length === 0 && !isAdmin) return;

    container.innerHTML = '';
    news.forEach((item, index) => {
        const fullUrl = S3_BASE + item.s3_key;
        const dateStr = new Date(item.created_at).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
        
        const article = document.createElement('article');
        article.className = 'post-classic news-item-wrap';
        article.dataset.id = item.id;
        
        let adminControls = '';
        if (isAdmin) {
            adminControls = `
            <div style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 30px;">
                <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px;">
                    <div style="display: flex; gap: 10px;">
                        <div style="flex-grow: 1;">
                            <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 4px; font-weight: bold;">NADPIS</label>
                            <input type="text" class="admin-title-edit" value="${item.title || ''}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 5px;">
                        </div>
                        <div style="width: 80px;">
                            <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 4px; font-weight: bold;">PORADIE</label>
                            <input type="number" class="admin-sort-edit" value="${index + 1}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 5px; text-align: center;">
                        </div>
                    </div>
                    <div>
                        <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 4px; font-weight: bold;">TEXT</label>
                        <textarea class="admin-desc-edit" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 5px; min-height: 80px;">${item.description || ''}</textarea>
                    </div>
                </div>
                <div style="text-align: right;">
                    <button class="admin-del-btn" data-id="${item.id}" data-key="${item.s3_key}" style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer;">Zmazať novinku</button>
                </div>
            </div>
            `;
        }

        article.innerHTML = `
            <a class="thumbnail-classic" href="${fullUrl}" data-lightgallery="item">
              <figure><img width="640" height="430" src="${fullUrl}" alt="${item.title || ''}"></figure>
            </a>
            <h5 class="post-classic-title">${item.title}</h5>
            <p>${item.description}</p>
            <ul class="list-inline list-inline-vertical-line">
              <li>${dateStr}</li>
              <li><span>autor: Leutschau Café</span></li>
            </ul>
            ${adminControls}
        `;
        container.appendChild(article);
    });

    if (isAdmin) {
        document.querySelectorAll('.admin-del-btn').forEach(btn => {
            btn.onclick = async () => {
                if (!confirm('Naozaj zmazať túto novinku?')) return;
                btn.disabled = true;
                await supabase.functions.invoke('s3-manager', { body: { action: 'delete', s3Key: btn.dataset.key } });
                await supabase.from('news_items').delete().eq('id', btn.dataset.id);
                location.reload();
            };
        });
    }
  }

  init();
})();
