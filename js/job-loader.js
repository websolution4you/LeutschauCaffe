import { supabase } from './supabase-client.js';

(function () {
  const S3_BASE = 'https://leutschau-gallery.s3.eu-central-1.amazonaws.com/';
  const container = document.querySelector('.post-vacancy-wrap');
  const adminContainer = document.createElement('div');
  adminContainer.id = 'admin-jobs-controls';
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
    loadJobs(isAdmin);
  }

  function setupAdminUI() {
    adminContainer.style.display = 'block';
    adminContainer.innerHTML = `
      <div style="text-align: left; background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #eee; margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
            <h4 style="margin: 0; color: #a3734a; font-family: 'Roboto Slab', serif; font-weight: 700;">Administrácia Pracovných Ponúk</h4>
            <div style="display: flex; gap: 12px;">
                <button id="admin-save-all-btn" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 0.95rem; font-weight: bold;">Uložiť poradie a zmeny</button>
                <button id="admin-logout-btn" style="background: #f8f9fa; border: 1px solid #ddd; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: #666;">Odhlásiť sa</button>
            </div>
        </div>
        
        <div style="background: #fcfcfc; padding: 20px; border-radius: 10px; border: 1px solid #eaeaea;">
            <p style="font-size: 0.9rem; margin-bottom: 15px; color: #444; font-weight: bold;">Pridať novú ponuku:</p>
            <div style="display: flex; flex-direction: column; gap: 15px;">
               <div style="display: flex; align-items: center; gap: 10px;">
                  <label for="admin-file-input" style="background: #a3734a; color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold;">+ Zvoliť obrázok (voliteľné)</label>
                  <input type="file" id="admin-file-input" accept="image/*" style="display:none;">
                  <div id="admin-preview-container"></div>
              </div>
              <input type="text" id="admin-title-input" placeholder="Názov pozície (napr. Čašník)" style="padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem;">
              <input type="text" id="admin-loc-input" placeholder="Lokalita / Typ (napr. Levoča - TPP)" style="padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem;">
              <textarea id="admin-desc-input" placeholder="Detaily ponuky (napr. Dátum nástupu: júl 2026)" style="padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; min-height: 80px;"></textarea>
              <button id="admin-upload-btn" style="background: #007bff; color: white; border: none; padding: 11px 30px; border-radius: 6px; cursor: pointer; font-weight: bold;">Pridať ponuku</button>
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
            const reader = new FileReader();
            reader.onload = (re) => {
                previewContainer.innerHTML = `<img src="${re.target.result}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 2px solid #ddd;">`;
            };
            reader.readAsDataURL(file);
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
        const items = Array.from(document.querySelectorAll('.job-item-wrap'));
        let updates = items.map(el => ({
            id: el.dataset.id,
            title: el.querySelector('.admin-title-edit').value,
            description: el.querySelector('.admin-desc-edit').value,
            requested_sort: parseFloat(el.querySelector('.admin-sort-edit').value) || 999
        }));
        updates.sort((a, b) => a.requested_sort - b.requested_sort);
        for (let i = 0; i < updates.length; i++) {
            await supabase.from('job_items').update({ 
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
      const loc = document.getElementById('admin-loc-input').value;
      const desc = document.getElementById('admin-desc-input').value;
      
      if (!title) { alert('Prosím zadajte názov pozície'); return; }
      
      uploadBtn.disabled = true;
      status.innerText = `Pridávam ponuku...`;

      try {
          let s3Key = '';
          if (file) {
              const { data, error: signErr } = await supabase.functions.invoke('s3-manager', {
                  body: { action: 'sign', fileName: file.name, contentType: file.type, folder: 'jobs' }
              });
              if (signErr) throw signErr;
              const uploadRes = await fetch(data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
              if (!uploadRes.ok) throw new Error('S3 upload zlyhal');
              s3Key = data.key;
          }

          const { error: dbErr } = await supabase.from('job_items').insert({
              s3_key: s3Key || `jobs/placeholder-${Date.now()}`, 
              title: title,
              description: JSON.stringify({ loc, desc }), // Enkódované dáta pre jednoduchosť
              sort_order: -Math.floor(Date.now() / 1000)
          });

          if (dbErr) throw dbErr;
          status.style.color = 'green';
          status.innerText = `Ponuka úspešne pridaná!`;
          setTimeout(() => location.reload(), 1000);
      } catch (err) {
          console.error(err);
          status.style.color = 'red';
          status.innerText = `Chyba: ${err.message}`;
          uploadBtn.disabled = false;
      }
    };
  }

  async function loadJobs(isAdmin) {
    const { data: jobs, error } = await supabase
      .from('job_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) return;
    if (jobs.length === 0 && !isAdmin) return;

    container.innerHTML = '';
    jobs.forEach((item, index) => {
        let jobData = { loc: 'Levoča', desc: '' };
        try { jobData = JSON.parse(item.description); } catch(e) {}
        
        const col = document.createElement('div');
        col.className = 'col-sm-6 job-item-wrap';
        col.dataset.id = item.id;
        
        let adminControls = '';
        if (isAdmin) {
            adminControls = `
            <div style="margin-top: 10px; background: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                <input type="text" class="admin-title-edit" value="${item.title}" style="width: 100%; margin-bottom: 5px; padding: 5px;">
                <textarea class="admin-desc-edit" style="width: 100%; margin-bottom: 5px; padding: 5px; font-size: 0.8rem;">${item.description}</textarea>
                <div style="display: flex; justify-content: space-between;">
                    <input type="number" class="admin-sort-edit" value="${index + 1}" style="width: 50px;">
                    <button class="admin-del-btn" data-id="${item.id}" data-key="${item.s3_key}" style="background: #dc3545; color: white; border: none; padding: 2px 10px; border-radius: 4px; font-size: 0.7rem;">Zmazať</button>
                </div>
            </div>
            `;
        }

        col.innerHTML = `
          <article class="post-vacancy post-vacancy-secondary">
            <h6 class="post-vacancy-title"><a href="contacts.html">${item.title}</a></h6>
            <div class="post-vacancy-body">
              <div class="unit align-items-center flex-row unit-spacing-xxs">
                <div class="unit-left"><span class="icon icon-sm mdi mdi-map-marker icon-gray-lighter"></span></div>
                <div class="unit-body"><p>${jobData.loc}</p></div>
              </div>
              <div class="unit align-items-center flex-row unit-spacing-xxs">
                <div class="unit-left"><span class="icon icon-sm mdi mdi-timelapse icon-gray-lighter"></span></div>
                <div class="unit-body"><p>${jobData.desc}</p></div>
              </div>
            </div>
          </article>
          ${adminControls}
        `;
        container.appendChild(col);
    });

    if (isAdmin) {
        document.querySelectorAll('.admin-del-btn').forEach(btn => {
            btn.onclick = async () => {
                if (!confirm('Naozaj zmazať túto ponuku?')) return;
                btn.disabled = true;
                if (!btn.dataset.key.includes('placeholder')) {
                    await supabase.functions.invoke('s3-manager', { body: { action: 'delete', s3Key: btn.dataset.key } });
                }
                await supabase.from('job_items').delete().eq('id', btn.dataset.id);
                location.reload();
            };
        });
    }
  }

  init();
})();
