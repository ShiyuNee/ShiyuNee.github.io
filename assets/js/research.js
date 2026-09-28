/* Progressive enhancement: figures remain ordinary image links without JavaScript. */
(() => {
  const dialog = document.getElementById('figure-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const image = dialog.querySelector('img');
  const caption = document.getElementById('figure-dialog-caption');
  const viewport = dialog.querySelector('.figure-dialog__viewport');
  const zoomButton = dialog.querySelector('.figure-dialog__zoom');
  let opener;
  function setNativeSize(enabled) {
    dialog.classList.toggle('figure-dialog--native', enabled);
    zoomButton.setAttribute('aria-pressed', String(enabled));
    zoomButton.textContent = enabled ? 'Fit whole figure' : 'Read at full size';
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
  }
  zoomButton.addEventListener('click', () => {
    setNativeSize(!dialog.classList.contains('figure-dialog--native'));
  });
  document.querySelectorAll('.figure-zoom').forEach(link => {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      image.src = link.querySelector('img').currentSrc || link.href;
      image.alt = link.querySelector('img').alt;
      caption.textContent = link.dataset.caption;
      const isOverview = link.classList.contains('motivation-zoom');
      zoomButton.hidden = !(isOverview || link.classList.contains('data-chart-zoom'));
      setNativeSize(isOverview);
      dialog.showModal();
    });
  });
  dialog.querySelector('.figure-dialog__close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    }
  });
  dialog.addEventListener('close', () => { if (opener) opener.focus(); });
})();
