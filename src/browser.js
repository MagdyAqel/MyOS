export function setupBrowser(content) {
  content.innerHTML = `
    <div class="browser-app">
      <form class="browser-toolbar" aria-label="شريط عنوان المتصفح">
        <button type="button" data-nav="back" aria-label="رجوع">←</button>
        <button type="button" data-nav="forward" aria-label="تقدم">→</button>
        <button type="button" data-nav="reload" aria-label="إعادة تحميل">↻</button>
        <button type="button" data-nav="home" aria-label="صفحة المتصفح الرئيسية">⌂</button>
        <input aria-label="عنوان الموقع" placeholder="https://example.com" dir="ltr" autocomplete="off">
        <button type="submit">انتقال</button>
        <a class="browser-external" target="_blank" rel="noopener noreferrer" hidden>فتح خارجي ↗</a>
      </form>
      <p class="browser-notice" role="status">بعض المواقع تمنع تضمينها؛ استخدم «فتح خارجي» إذا لم تظهر الصفحة. يقبل المتصفح روابط HTTPS فقط.</p>
      <div class="browser-home"><span class="eyebrow">MYOS EXPLORER</span><h2>إلى أين تأخذك أفكارك؟</h2><p>أدخل عنوان موقع في الشريط العلوي.</p><div class="browser-bookmarks"><button data-url="https://example.com">◉<br>موقع تجريبي</button><button data-url="https://www.wikipedia.org">W<br>ويكيبيديا</button></div><p class="muted">الرجوع والتقدم يتتبعان العناوين المدخلة هنا. التنقّل داخل موقع خارجي تديره الصفحة نفسها.</p></div>
      <iframe class="browser-frame" title="صفحة الموقع" sandbox="allow-scripts allow-same-origin allow-forms" referrerpolicy="no-referrer" hidden></iframe>
    </div>`;
  const input = content.querySelector('input');
  const frame = content.querySelector('iframe');
  const home = content.querySelector('.browser-home');
  const external = content.querySelector('.browser-external');
  const notice = content.querySelector('.browser-notice');
  const history = ['about:home'];
  let position = 0;
  function render() {
    const address = history[position];
    const isHome = address === 'about:home';
    input.value = isHome ? '' : address;
    frame.hidden = isHome;
    home.hidden = !isHome;
    external.hidden = isHome;
    if (isHome) { frame.removeAttribute('src'); external.removeAttribute('href'); }
    else { frame.src = address; external.href = address; }
    content.querySelector('[data-nav="back"]').disabled = position === 0;
    content.querySelector('[data-nav="forward"]').disabled = position === history.length - 1;
  }
  function navigate(value) {
    let address;
    try {
      const text = value.trim();
      if (!text) throw new Error();
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
      address = url.href;
    } catch {
      notice.textContent = 'أدخل عنوان HTTPS صالحًا، مثل https://example.com';
      return;
    }
    notice.textContent = 'إذا منع الموقع عرضه هنا، اضغط «فتح خارجي». لا يمكن للمحاكاة تجاوز سياسة الموقع.';
    history.splice(position + 1);
    history.push(address);
    position++;
    render();
  }
  content.querySelector('form').onsubmit = event => { event.preventDefault(); navigate(input.value); };
  content.querySelectorAll('[data-url]').forEach(button => button.onclick = () => navigate(button.dataset.url));
  content.querySelector('[data-nav="back"]').onclick = () => { if (position > 0) { position--; render(); } };
  content.querySelector('[data-nav="forward"]').onclick = () => { if (position < history.length - 1) { position++; render(); } };
  content.querySelector('[data-nav="home"]').onclick = () => { history.splice(position + 1); history.push('about:home'); position++; render(); };
  content.querySelector('[data-nav="reload"]').onclick = render;
  render();
  return () => frame.removeAttribute('src');
}
