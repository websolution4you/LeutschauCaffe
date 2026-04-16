import { supabase } from './supabase-client.js';

(function () {
  // POZOR: Tu si doplňte svoju reálnu S3 URL
  const S3_BASE = 'https://YOUR_BUCKET.s3.YOUR_REGION.amazonaws.com/';
  const container = document.querySelector('[data-lightgallery="group"]');
  if (!container) return;

  async function loadGallery() {
    // OPRAVA: Načítavame len potrebné polia pre verejný web
    const { data: photos, error } = await supabase
      .from('gallery_items')
      .select('id, s3_key, alt_text, sort_order')
      .eq('is_active', true) // Iba aktívne fotky
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
      col.innerHTML = `
        <a class="thumbnail-rayen thumbnail-md" data-lightgallery="item" href="${fullUrl}">
          <figure>
            <img width="460" height="345" src="${fullUrl}" alt="${photo.alt_text || ''}">
            <figcaption><span class="icon icon-white mdi mdi-magnify-plus"></span></figcaption>
          </figure>
        </a>`;
      container.appendChild(col);
    });

    // Re-init LightGallery
    if (window.jQuery && jQuery.fn.lightGallery) {
      const $lg = jQuery(container);
      if ($lg.data('lightGallery')) $lg.data('lightGallery').destroy(true);
      $lg.lightGallery({ selector: '[data-lightgallery="item"]' });
    }
  }

  loadGallery();
})();
