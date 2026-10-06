# Eternia Codex – Dark Fantasy Gacha (v3)

Phiên bản quản lý đơn giản & hiệu quả hơn.

## Cấu trúc thư mục

```
eternia-codex/
├── index.html
├── css/style.css
├── js/
│   ├── app.js          # Logic chính
│   ├── gacha.js        # Roll rarity + pull
│   ├── storage.js      # localStorage + export/import
│   └── ui.js           # Render media, card, toast, modal
├── data/
│   └── characters.json # ← Chỉ cần sửa file này để thêm/sửa thẻ
└── assets/
    ├── cards/
    │   ├── SSS/        # 601.png, 602.gif, 603.mp4 ...
    │   ├── SS/
    │   ├── S/
    │   ├── A/
    │   ├── B/
    │   ├── C/
    │   └── D/
    ├── frames/         # (tùy chọn)
    └── data/           # (tùy chọn lore .txt)
```

## Cách thêm thẻ mới (siêu đơn giản)

1. Thêm 1 object vào `data/characters.json`:
```json
{
  "id": "604",
  "name": "Tên thẻ",
  "title": "Danh hiệu",
  "rarity": "SSS",
  "element": "Fire",
  "power": 9999,
  "mediaType": "image",
  "mediaExt": "png",
  "media": "cards/SSS/604.png",
  "lore": "Mô tả lore..."
}
```

2. Thả file ảnh/video vào đúng chỗ:
   `assets/cards/SSS/604.png`

Xong. Không cần đụng code JS.

## Cách chạy

- Mở bằng Live Server (VS Code) hoặc bất kỳ static server nào.
- Hoặc dùng: `npx serve .` (trong thư mục project)

**Lưu ý:** Vì dùng `fetch` + ES modules nên **không mở trực tiếp file://** được. Cần chạy qua HTTP server.

## Tính năng có sẵn

- Pull 1 / Pull 10
- Daily limit 10 pulls (tự reset mỗi ngày)
- Collection + filter theo rarity
- Modal xem chi tiết
- Export / Import collection (JSON)
- Hỗ trợ ảnh PNG/JPG/WebP/GIF + video MP4/WebM
- Frame + glow theo rarity (SSS có particle)

## Placeholder ảnh

Nếu chưa có ảnh thật, web sẽ hiện placeholder (placehold.co) với tên nhân vật.
Chỉ cần thả file đúng tên vào `assets/cards/...` là tự hiện.
