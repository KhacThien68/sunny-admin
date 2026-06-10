# Thiết kế: Sunny Admin — MRP Portal

**Ngày:** 2026-06-10 (cập nhật theo phản hồi review lần 1)
**Nguồn yêu cầu:** `DVC_Test MRP_V7.xlsx` (sheet `1.0 Input`, `2.0 Process`, `3.0 Output`; dữ liệu mẫu ở `KB1`, `BoM`, `Tinh toan`)

## 1. Mục tiêu

Xây dựng admin portal quản lý MRP (Material Requirements Planning) cho sản xuất:
khai báo mã vật tư, BoM, nhân sự, tồn kho, đơn hàng → chạy thuật toán MRP đa vòng
→ tổng hợp số lượng cần mua, tồn kho PSI.

Phạm vi v1: **Core MRP đầy đủ** — 6 màn Input + engine MRP + màn Output 3.1/3.2 + login/phân quyền.
Các mục đánh dấu "phát triển sau" trong Excel (luồng phê duyệt, gửi mail thật, điều chỉnh Levels,
phân nhóm thành phần) và **Dashboard (chỉ để trang trắng)**, **Thông báo công việc (3.3)** không nằm trong v1.

## 2. Kiến trúc & công nghệ

Monorepo `sunny-admin/`:

| Phần | Công nghệ |
|------|-----------|
| `frontend/` | Vite + React 18 + TypeScript + Ant Design 5 + React Router + TanStack Query + Zustand (auth store) |
| `backend/` | NestJS 10 + TypeORM + MySQL 8, JWT (access + refresh), bcrypt, class-validator, ExcelJS |
| Hạ tầng dev | MySQL cài sẵn trên máy (external), cấu hình kết nối qua `backend/.env` |

- UI hoàn toàn **tiếng Việt**, thuật ngữ theo cột "Thuật ngữ (Vie)" của sheet Input.
- Import Excel trên các màn Input, **tên cột đúng theo thuật ngữ tiếng Anh** trong sheet Input
  (`Component`, `Component classification`, `Component description`, `UoM`, `MoB (Make or Buy)`, `MoQ`, `Inventory Levels`, …).

## 3. Xác thực (Auth)

- **Access token (JWT, ngắn hạn ~15 phút):** chỉ lưu trong **store của app (Zustand, in-memory)**.
  **Tuyệt đối không lưu localStorage/sessionStorage.**
- **Refresh token (dài hạn ~7 ngày):** lưu trong **cookie `httpOnly`** (SameSite=Lax, Secure khi production),
  do backend set qua endpoint login/refresh. FE không đọc được token này.
- Luồng: login → BE trả access token (body) + set cookie refresh → FE giữ access trong store;
  khi access hết hạn hoặc F5 mất store → gọi `POST /auth/refresh` (cookie tự gửi) → nhận access mới.
- Logout: BE xóa cookie + revoke refresh token (lưu hash refresh token trong DB để revoke được).

## 4. Phân quyền (per-user, per-screen, CRUD)

Phân quyền **theo từng user trên từng màn hình** với 4 quyền cơ bản **C / R / U / D**:

- Bảng `permissions`: `user_id + screen_key + can_create/can_read/can_update/can_delete`.
- `screen_key` là enum cố định: `COMPONENTS, BOM, PERSONNEL, PURCHASING_TEAMS, ONHAND, ORDERS, MRP, OUTPUT_PURCHASE, OUTPUT_PSI, USERS, PERMISSIONS`.
- `users.is_admin = true` → toàn quyền mọi màn hình (bỏ qua bảng permissions).
- **Màn hình Phân quyền** (chỉ admin): chọn user → ma trận màn hình × CRUD (checkbox) → lưu.
- FE: menu ẩn màn không có quyền R; nút Thêm/Sửa/Xóa ẩn theo C/U/D. BE: guard kiểm tra quyền thật sự trên từng endpoint (không chỉ ẩn UI).
- **Phát triển sau:** gán quyền mặc định theo vai trò khi tạo user (role template).

## 5. Danh sách màn hình

| # | Màn hình | Nguồn Excel | Chức năng chính |
|---|----------|-------------|-----------------|
| 0 | Đăng nhập | — | JWT như mục 3; seed sẵn tài khoản admin |
| 1 | Dashboard | — | **V1: trang trắng (placeholder), làm sau** |
| 2 | Quản lý mã | Input #1 (Kho) | CRUD Component: mã, phân loại, mô tả, UoM, MoB (Không/Có thể/Bắt buộc mua), MoQ, Tồn định mức. Import Excel |
| 3 | Quản lý BoM | Input #2 (RnD) | Khai báo dòng BoM cha–con + định mức/1 đơn vị cha. Mã chưa khai báo ở Quản lý mã: **bôi đỏ + modal dẫn về khai báo**. Xem cây BoM đa cấp. Import Excel |
| 4 | Nhân sự | Input #3 (HR) | CRUD: tên, chức vụ, bộ phận, mail, SĐT. Import Excel |
| 5 | Team mua hàng | Input #4 (CCU) | **Danh sách các team mua hàng**; click vào team → **trang chi tiết**: thêm/xóa nhân viên vào team, chọn **loại hàng hóa (Component classification) hoặc mã cụ thể** mà team phụ trách mua. Cảnh báo thành phần chưa có team phụ trách |
| 6 | Hàng thực tế | Input #5 (Kho) | Nhập On-Hand Inventory theo mã (không nhập = 0); mã chưa khai báo: bôi đỏ + modal. Import Excel |
| 7 | Đơn hàng | Input #6 (KD) | Nhập đơn theo nhóm khách hàng (mã SP + số lượng); nút **"Tổng hợp"** gộp các đơn thành nhu cầu tổng theo Material |
| 8 | Chạy MRP | Process 2.1–2.N | Tạo phiên chạy từ đơn hàng tổng hợp; mỗi vòng hiển thị bảng Demand/Purchase/Manufacturing; người dùng điều chỉnh cột Purchase (theo ràng buộc MoB) rồi **"Chốt vòng"** để bổ BoM vòng tiếp; lịch sử phiên chạy |
| 9 | Tổng hợp mua & Thu hồi phế | Output 3.1 | 2 bảng: Purchase và Recovery — cột Tổng + từng vòng 2.1, 2.2, … |
| 10 | Tồn kho PSI | Output 3.2 | On-Hand + Purchase − Sale = Closing (Closing = Tồn định mức; Sale suy ra) |
| 11 | Quản trị người dùng | — | CRUD user (admin) |
| 12 | Phân quyền | — | Ma trận user × màn hình × CRUD (admin) |

**Làm sau:** Dashboard (nội dung), Thông báo công việc (Output 3.3).

## 6. Engine MRP

> **Lưu ý công thức:** sheet Process ghi chữ `Order + On-Hand - Levels = Demand` nhưng ví dụ số
> (Order 50, OnHand 3, Levels 2 → Demand 49) chứng minh công thức đúng là:
> **`Demand = Order − On-Hand + Levels`**. Engine làm theo ví dụ số.

### Vòng 1 (2.1)
1. Lấy đơn hàng tổng hợp theo Material.
2. `Demand = Order − OnHand + Levels`. Nếu `< 0` → `Demand = 0`, phần dư (giá trị tuyệt đối) ghi vào **Thu hồi phế (Recovery)** của vòng.
3. Chia Purchase / Manufacturing theo MoB:
   - **Bắt buộc mua** → Purchase = Demand (làm tròn lên theo MoQ), Manufacturing = 0, ô khóa.
   - **Không (sản xuất)** → Purchase = 0 (ô khóa), Manufacturing = Demand.
   - **Có thể mua** → mặc định Manufacturing = Demand, người dùng tự chia lại; ràng buộc Purchase + Manufacturing = Demand, Purchase làm tròn theo MoQ.

### Vòng n+1 (2.2 … 2.N)
1. Lấy các dòng Manufacturing > 0 của vòng n, nhân với định mức BoM (con trực tiếp) → gross demand từng Component con; cộng dồn các mã trùng.
2. `OnHand(vòng n) = OnHand ban đầu + tổng Purchase các vòng trước` của mã đó (ghi chú sheet Process).
3. `Levels = 0` nếu mã đã từng có Demand ở vòng trước.
4. Tính Demand và chia Purchase/Manufacturing như vòng 1.

### Điều kiện dừng
Tất cả Manufacturing của vòng = 0, hoặc đạt tối đa **9 vòng**.

### Lưu trữ
- `mrp_runs`: id, trạng thái (DRAFT/RUNNING/DONE), người tạo, thời điểm, snapshot đơn hàng nguồn.
- `mrp_lines`: run_id, round, component_id, order_qty, onhand, levels, demand, purchase, manufacturing, recovery.
- Vòng đang mở cho phép sửa Purchase; "Chốt vòng" sinh vòng tiếp theo; chốt vòng cuối → run DONE.

## 7. Mô hình dữ liệu (MySQL / TypeORM)

```
users                  id, name, position, team, email(unique), phone, password_hash, is_admin, is_active
permissions            id, user_id(FK), screen_key(ENUM), can_create, can_read, can_update, can_delete
                       (unique: user_id + screen_key)
refresh_tokens         id, user_id(FK), token_hash, expires_at, revoked_at
components             id, code(unique), classification, description, uom, mob(ENUM: KHONG|CO_THE|BAT_BUOC),
                       moq, inventory_level, created_at, updated_at
bom_lines              id, parent_component_id(FK), child_component_id(FK), quantity_per_unit
                       (unique: parent+child) — cây đa cấp suy ra bằng đệ quy
purchasing_teams       id, name, description
purchasing_team_members    id, team_id(FK), user_id(FK)   (unique: team+user)
purchasing_team_scopes     id, team_id(FK), classification(nullable), component_id(FK, nullable)
                       — một trong hai trường phải có (phụ trách theo loại hàng hoặc mã cụ thể)
onhand_inventory       id, component_id(FK, unique), quantity
orders                 id, code, customer_group, note, status(DRAFT|AGGREGATED), created_by, created_at
order_lines            id, order_id(FK), component_id(FK), quantity
order_aggregations     id, created_at, created_by  +  aggregation_lines(component_id, total_qty)
mrp_runs / mrp_lines   như mục 6
```

Tham chiếu "mã chưa khai báo": BoM/On-Hand import chấp nhận mã lạ nhưng đánh dấu `unregistered`
(lưu mã thô kèm cờ), UI bôi đỏ và dẫn về Quản lý mã — đúng hành vi mô tả trong Excel.

## 8. Import Excel

- Mỗi màn Input có nút **"Tải file mẫu"** (xlsx, header chuẩn) và **"Import Excel"**.
- Backend parse bằng ExcelJS, validate từng dòng, trả kết quả: số dòng OK / danh sách lỗi (dòng, cột, lý do).
- Hành vi upsert theo khóa nghiệp vụ (vd `Component` code); người dùng xem preview lỗi trước khi xác nhận ghi.

Header file mẫu theo màn:
- Quản lý mã: `Component | Component classification | Component description | UoM | MoB (Make or Buy) | MoQ | Inventory Levels`
- BoM: `Material | Material description | Component | Component description | Quantity`
- Nhân sự: `Personal | Position | Team | Mail | Phone`
- Hàng thực tế: `Component | Component description | On-Hand Inventory`
- Đơn hàng: `Customer group | Material | Material description | Order quantity`

## 9. Xử lý lỗi & cảnh báo

- Import: lỗi từng dòng, không chặn dòng hợp lệ (người dùng chọn "ghi các dòng hợp lệ" hoặc hủy).
- BoM/On-Hand tham chiếu mã chưa khai báo: cảnh báo đỏ + modal điều hướng (theo đúng spec Excel).
- MRP: chặn chạy nếu chưa có đơn hàng tổng hợp; cảnh báo nếu Material trong đơn không có BoM; vòng lặp BoM (A chứa B chứa A) → báo lỗi rõ ràng, không treo.
- Auth: refresh token revoke được; tài khoản khóa `is_active = false` không refresh được.

## 10. Kiểm thử

- **TDD cho engine MRP** (quan trọng nhất): unit test thuật toán từng vòng, MoQ rounding, MoB constraint,
  điều kiện dừng, recovery — đối chiếu số liệu với sheet `Tinh toan`.
- Unit test parser import Excel (header sai, dòng lỗi, mã trùng).
- Test guard phân quyền CRUD theo user-screen.
- FE: build + smoke test các route chính.

## 11. Ngoài phạm vi v1 (ghi nhận để phát triển sau)

- Nội dung Dashboard (v1 là trang trắng).
- Thông báo công việc (Output 3.3) + gửi mail thật.
- Quyền mặc định theo vai trò khi tạo user (role template).
- Luồng phê duyệt BoM, đơn hàng, số lượng mua cuối.
- Điều chỉnh Levels, Phân nhóm thành phần, mức độ ưu tiên (cột "Phát triển sau" sheet Input).
