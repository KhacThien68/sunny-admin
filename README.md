# Sunny Admin — MRP Portal

Cổng quản trị **MRP (Material Requirements Planning)** cho sản xuất: khai báo mã vật tư, BoM,
nhân sự, tồn kho, đơn hàng → chạy thuật toán MRP đa vòng → tổng hợp số lượng cần mua và tồn kho PSI.

Kiến trúc: **React SPA** (Vite + TypeScript + Ant Design 5) + **NestJS 10** (TypeORM) + **MySQL 8**.
Toàn bộ giao diện tiếng Việt. Nguồn yêu cầu: `DVC_Test MRP_V7.xlsx` (sheet Input / Process / Output).

---

## Yêu cầu hệ thống

- Node.js 20+
- MySQL 8 (cài đặt cục bộ — không dùng Docker)

---

## Khởi tạo & chạy

### 1. Tạo database (chạy một lần)

```bash
mysql -h localhost -P 3306 -u root -proot -e "CREATE DATABASE IF NOT EXISTS sunny_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 2. Cấu hình backend

Tạo `backend/.env` (mẫu có sẵn ở `backend/.env.example`):

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=root
DB_NAME=sunny_admin
JWT_ACCESS_SECRET=dev_access_secret_change_me
JWT_REFRESH_SECRET=dev_refresh_secret_change_me
JWT_ACCESS_TTL=900s
JWT_REFRESH_TTL=7d
```

### 3. Chạy backend

```bash
cd backend
npm install
npm run seed        # tạo tài khoản admin lần đầu (idempotent)
npm run start:dev   # http://localhost:3000  (API prefix /api)
```

### 4. Chạy frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173  (proxy /api → :3000)
```

### Tài khoản mặc định

| Email | Mật khẩu |
|-------|----------|
| admin@sunny.local | admin123 |

---

## Cấu trúc thư mục

```
sunny-admin/
├── backend/                 # NestJS API
│   └── src/
│       ├── auth/            # đăng nhập JWT, refresh token (cookie httpOnly), rotation
│       ├── permissions/     # phân quyền per-user × màn hình × CRUD + guard
│       ├── users/           # quản trị người dùng + nhân sự (+ import)
│       ├── components/      # quản lý mã (CRUD + import Excel)
│       ├── bom/             # BoM (cây đa cấp, kiểm tra lặp vòng, import)
│       ├── onhand/          # tồn kho thực tế
│       ├── purchasing-teams/# team mua hàng + phạm vi phụ trách
│       ├── orders/          # đơn hàng + tổng hợp (aggregation)
│       ├── mrp/
│       │   ├── engine/      # thuật toán MRP thuần (pure functions, TDD)
│       │   └── ...          # orchestration: phiên chạy + các vòng
│       ├── outputs/         # tổng hợp mua / thu hồi / PSI
│       └── common/          # excel service, guards, decorators, transformers
└── frontend/                # React SPA
    └── src/
        ├── api/             # client axios + các hàm gọi API theo module
        ├── stores/auth.ts   # access token in-memory (Zustand, KHÔNG localStorage)
        ├── layouts/         # AppLayout + menu ẩn theo quyền
        ├── hooks/           # usePermission
        ├── components/      # ImportExcelButton, UnregisteredCode, RequireAuth
        └── pages/           # các màn hình
```

---

## Các màn hình

| Nhóm | Màn hình | Đường dẫn |
|------|----------|-----------|
| Tổng quan | Dashboard (placeholder) | `/` |
| Khai báo | Quản lý mã | `/components` |
| Khai báo | Quản lý BoM | `/bom` |
| Khai báo | Nhân sự | `/personnel` |
| Khai báo | Team mua hàng (+ chi tiết) | `/purchasing-teams` |
| Khai báo | Hàng thực tế | `/onhand` |
| Khai báo | Đơn hàng | `/orders` |
| Tính toán | Chạy MRP (+ chi tiết phiên) | `/mrp` |
| Kết quả | Tổng hợp mua & Thu hồi phế | `/outputs/purchase` |
| Kết quả | Tồn kho PSI | `/outputs/psi` |
| Quản trị | Quản trị người dùng | `/users` |
| Quản trị | Phân quyền | `/permissions` |

Mỗi màn Khai báo có nút **Tải file mẫu** và **Import Excel** (tên cột theo thuật ngữ tiếng Anh
trong sheet Input: `Component`, `UoM`, `MoB (Make or Buy)`, `MoQ`, `Inventory Levels`, …).

---

## Bảo mật & phân quyền

- **Access token** (JWT ngắn hạn) chỉ giữ trong bộ nhớ ứng dụng (Zustand) — không lưu localStorage.
- **Refresh token** chỉ nằm trong cookie `httpOnly` (path `/api/auth`), có rotation + revoke trong DB.
- Phân quyền theo **từng người dùng × từng màn hình × C/R/U/D**; backend chặn bằng guard, không chỉ ẩn UI.
- Tài khoản `isAdmin` có toàn quyền.

---

## Thuật toán MRP

Công thức (theo ví dụ số trong sheet Process — Order 50, OnHand 3, Levels 2 → Demand 49):

```
Demand = Order − On-Hand + Levels   (nếu < 0 → Demand = 0, phần dư ghi vào Thu hồi phế)
```

Phân bổ theo MoB: **Bắt buộc mua** → Purchase = max(Demand, MoQ); **Sản xuất** → Manufacturing = Demand;
**Có thể mua** → mặc định sản xuất, người dùng chỉnh Purchase (0 hoặc ≥ MoQ).
Mỗi vòng "bổ BoM": nhân Manufacturing với định mức BoM con → nhu cầu vòng kế tiếp.
On-Hand vòng sau = On-Hand ban đầu + tổng Purchase các vòng trước; Levels = 0 nếu mã đã có Demand ở vòng trước.
Dừng khi mọi Manufacturing = 0 hoặc đạt tối đa 9 vòng.

---

## Kiểm thử

```bash
cd backend && npm test     # 168 unit/integration tests (engine MRP, import, guard, ...)
cd frontend && npm run build
```

Các màn hình đã được kiểm thử end-to-end bằng Playwright. Kịch bản MRP đối chiếu với ví dụ Excel:
`MRP-CHA` (Order 50, On-Hand 3, Levels 2) → Demand **49** → bổ BoM ra `MRP-CON` (98) → mua 10, sản xuất 88
→ bổ BoM ra `MRP-LA` (88, bắt buộc mua) → hoàn tất; màn Output PSI: `Sale = On-Hand + Purchase − Closing`.

---

## Ngoài phạm vi v1 (phát triển sau)

- Nội dung Dashboard, Thông báo công việc (Output 3.3) + gửi mail thật.
- Luồng phê duyệt BoM / đơn hàng / số lượng mua; quyền mặc định theo vai trò khi tạo user.
