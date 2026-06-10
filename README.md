# Sunny Admin

Cổng quản trị MRP (Material Requirements Planning) cho hệ thống Sunny.  
Kiến trúc: **React SPA** (frontend) + **NestJS** (backend) + **MySQL 8**.

---

## Yêu cầu hệ thống

- Node.js 20+
- MySQL 8 (cài đặt cục bộ, không dùng Docker)

---

## Khởi tạo database

Chạy lệnh sau một lần duy nhất để tạo database:

```sql
CREATE DATABASE IF NOT EXISTS sunny_admin
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Hoặc qua CLI:

```bash
mysql -h localhost -P 3306 -u root -proot -e \
  "CREATE DATABASE IF NOT EXISTS sunny_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

---

## Cài đặt & chạy

### 1. Cấu hình backend

Tạo file `backend/.env` (xem Task 2 để biết các biến cần thiết):

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=root
DB_NAME=sunny_admin
```

### 2. Chạy backend

```bash
cd backend
npm install
npm run start:dev
```

### 3. Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Tài khoản mặc định

| Trường   | Giá trị             |
|----------|---------------------|
| Email    | admin@sunny.local   |
| Password | admin123            |
