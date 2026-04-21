import { supabase } from './supabase-client.js';

(function () {
  const container = document.querySelector('.quote-classic-wrap');
  const placeholderImg = 'images/user-placeholder.jpg'; // Musíme sa uistiť, že tento súbor existuje alebo použiť iný placeholder

  if (!container) return;

  async function loadGoogleReviews() {
    container.innerHTML = '<div class="col-12 text-center"><p>Načítavam reálne Google recenzie...</p></div>';

    try {
      const { data, error } = await supabase.functions.invoke('google-reviews');
      
      if (error) throw error;
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="col-12 text-center"><p>Momentálne nie sú k dispozícii žiadne recenzie.</p></div>';
        return;
      }

      container.innerHTML = '';
      
      data.forEach(review => {
        // Google vracia profile_photo_url, ak ju autor má
        const photoUrl = review.profile_photo_url || placeholderImg;
        const authorName = review.author_name;
        const text = review.text;
        // Hviezdičky môžeme tiež zobraziť, ak chceme (review.rating)

        const reviewEl = document.createElement('div');
        reviewEl.className = 'col-sm-12';
        reviewEl.innerHTML = `
          <div class="unit unit-sm flex-md-row quote-classic">
            <div class="unit-left">
              <img class="rounded-circle" src="${photoUrl}" width="120" height="120" alt="${authorName}" onerror="this.src='images/user-01-120x120.jpg'">
            </div>
            <div class="unit-body">
              <div class="quote-classic-body">
                <span class="icon icon-rotate-180 mdi mdi-format-quote"></span>
                <p>${text}</p>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px;">
                   <a href="${review.author_url}" target="_blank" style="font-weight: bold; color: #a3734a;">${authorName}</a>
                   <div class="google-stars" style="color: #f1c40f;">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                </div>
              </div>
            </div>
          </div>
        `;
        container.appendChild(reviewEl);
      });

    } catch (err) {
      console.error('Chyba pri načítaní recenzií:', err);
      let errorMsg = 'Nepodarilo sa načítať Google recenzie.';
      
      // Pokúsime sa získať presnú správu z error objektu Supabase
      if (err.context && err.context.message) {
          errorMsg += ` (Detail: ${err.context.message})`;
      } else if (err.message) {
          errorMsg += ` (Chyba: ${err.message})`;
      }

      container.innerHTML = `<div class="col-12 text-center"><p style="color: red;">${errorMsg}<br><small>Najčastejšie: Neaktívny Billing v Google Console alebo nepovolená Places API.</small></p></div>`;
    }
  }

  loadGoogleReviews();
})();
