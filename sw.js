// ===== Sổ Tay Công Việc — Service Worker =====
// Vai trò:
// 1) Nhận nội dung được "Chia sẻ" từ app khác (Zalo, Gmail, Thư viện ảnh...)
//    rồi lưu tạm vào IndexedDB để trang chính đọc ra và điền sẵn vào ô nhập việc.
// 2) Cho phép trình duyệt nhận diện đây là PWA cài đặt được.

const DB_NAME = 'sotaycongviec_onedrive_db';
const STORE_NAME = 'kv';
const SHARE_KEY = 'pendingShare';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Bắt đúng yêu cầu gửi tới khi ai đó bấm "Chia sẻ" -> chọn app này
  if (req.method === 'POST' && url.pathname.endsWith('/share-target.html')) {
    event.respondWith((async () => {
      try {
        const formData = await req.formData();
        const title = formData.get('title') || '';
        const text = formData.get('text') || '';
        const sharedUrl = formData.get('url') || '';
        const files = [];
        for (const f of formData.getAll('files')) {
          if (f && typeof f === 'object' && 'name' in f) {
            files.push({ name: f.name, type: f.type, size: f.size, blob: f });
          }
        }
        await idbSet(SHARE_KEY, { title, text, url: sharedUrl, files, ts: Date.now() });
      } catch (e) {
        // Không đọc được nội dung chia sẻ -> vẫn cứ chuyển về app bình thường
      }
      return Response.redirect('./index.html?shared=1', 303);
    })());
  }
});
