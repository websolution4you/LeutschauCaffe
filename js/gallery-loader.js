/**
 * Galéria loader – načíta fotky z data/gallery.json a vloží ich do stránky.
 * Potom reštartuje LightGallery, aby lupy fungovali na nových fotkách.
 */
(function () {
  var container = document.querySelector('[data-lightgallery="group"]');
  if (!container) return;

  fetch('data/gallery.json')
    .then(function (r) { return r.json(); })
    .then(function (photos) {
      // Vymazat statický obsah, nahradiť dynamickým
      container.innerHTML = '';

      photos.forEach(function (photo) {
        var col = document.createElement('div');
        col.className = 'col-sm-10 col-md-6';
        col.innerHTML =
          '<a class="thumbnail-rayen thumbnail-md" data-lightgallery="item" href="' + photo.src + '">' +
            '<figure>' +
              '<img width="460" height="345" src="' + photo.src + '" alt="' + (photo.alt || '') + '">' +
              '<figcaption><span class="icon icon-white mdi mdi-magnify-plus"></span></figcaption>' +
            '</figure>' +
          '</a>';
        container.appendChild(col);
      });

      // Reštartovať LightGallery na novom obsahu (lupa bude fungovať)
      if (window.jQuery && jQuery.fn.lightGallery) {
        jQuery(container).lightGallery({ selector: '[data-lightgallery="item"]' });
      }
    })
    .catch(function (e) { console.error('Galéria sa nenačítala:', e); });
})();
