# Sunny Admin — MRP Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng admin portal MRP: 6 màn Input + engine MRP đa vòng + 2 màn Output, có login (access token in-memory, refresh token httpOnly cookie) và phân quyền per-user per-screen CRUD.

**Architecture:** Monorepo `frontend/` (Vite + React 18 + TS + Ant Design 5 + TanStack Query + Zustand) và `backend/` (NestJS 10 + TypeORM + **MySQL cài sẵn trên máy — external, KHÔNG dùng Docker**; kết nối cấu hình qua `backend/.env`). FE gọi BE qua Vite proxy `/api` → `localhost:3000`. Engine MRP là pure functions, test bằng Jest, đối chiếu số liệu mẫu của file Excel.

**Tech Stack:** NestJS 10, TypeORM 0.3 (synchronize=true cho dev), mysql2, @nestjs/jwt, bcrypt, exceljs, class-validator, cookie-parser; React 18, Vite 5, antd 5, @tanstack/react-query, zustand, axios, react-router-dom 6.

**Spec:** `docs/superpowers/specs/2026-06-10-mrp-admin-portal-design.md` — đọc trước khi làm.

**Quy ước chung:**
- Mọi route BE prefix `/api`. Mọi endpoint (trừ auth) bảo vệ bằng `JwtAuthGuard` + `PermissionGuard`.
- Screen keys: `COMPONENTS, BOM, PERSONNEL, PURCHASING_TEAMS, ONHAND, ORDERS, MRP, OUTPUT_PURCHASE, OUTPUT_PSI, USERS, PERMISSIONS`.
- UI tiếng Việt. Commit message tiếng Anh, conventional commits.
- Test backend: `cd backend; npm test`. Sau mỗi task: chạy test → commit.

---

## Phase 0 — Hạ tầng repo

### Task 1: Khởi tạo repo + database trên MySQL cài sẵn

**Files:**
- Create: `.gitignore`, `README.md`

> MySQL đã cài sẵn trên máy dev (external). Thông tin kết nối nằm trong `backend/.env` (Task 2). KHÔNG dùng Docker.

- [x] **Step 1: git init + .gitignore**

```bash
git init
```

`.gitignore`:
```
node_modules/
dist/
.env
*.log
.DS_Store
```

- [x] **Step 2: Tạo database** — dùng mysql client có sẵn trên máy:

```powershell
mysql -h localhost -P 3306 -u root -p -e "CREATE DATABASE IF NOT EXISTS sunny_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

(Nếu `mysql` không có trong PATH, tìm trong `C:\Program Files\MySQL\MySQL Server *\bin\`. Credentials thực tế lấy từ người dùng / `backend/.env`.)

- [x] **Step 3: README.md** — ghi cách chạy: yêu cầu MySQL local + tạo database `sunny_admin`, cấu hình `backend/.env`, `cd backend && npm run start:dev`, `cd frontend && npm run dev`, tài khoản mặc định `admin@sunny.local / admin123`.

- [x] **Step 4: Verify** — `mysql ... -e "SHOW DATABASES LIKE 'sunny_admin'"` → 1 dòng.

- [x] **Step 5: Commit** — `git add -A; git commit -m "chore: init repo"`

### Task 2: Scaffold backend NestJS + TypeORM

**Files:**
- Create: `backend/` (nest new), `backend/.env`, `backend/src/config/typeorm.config.ts`, sửa `backend/src/main.ts`, `backend/src/app.module.ts`

- [x] **Step 1: Scaffold**

```bash
npx @nestjs/cli@10 new backend --package-manager npm --skip-git
cd backend
npm i @nestjs/typeorm typeorm mysql2 @nestjs/jwt @nestjs/config bcrypt cookie-parser exceljs class-validator class-transformer
npm i -D @types/bcrypt @types/cookie-parser @types/multer
```

- [x] **Step 2: `backend/.env`** (và `.env.example` cùng nội dung):

```
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

- [x] **Step 3: `app.module.ts`** — `ConfigModule.forRoot({isGlobal:true})` + `TypeOrmModule.forRootAsync` đọc env, `autoLoadEntities: true`, `synchronize: true` (dev). `main.ts`: `app.setGlobalPrefix('api')`, `app.use(cookieParser())`, `app.useGlobalPipes(new ValidationPipe({whitelist:true, transform:true}))`, listen 3000. Thêm `GET /api/health` trả `{status:'ok'}` trong AppController.

- [x] **Step 4: Verify**

Run: `npm run start:dev` (background) rồi `curl http://localhost:3000/api/health`
Expected: `{"status":"ok"}`, log TypeORM connect thành công.

- [x] **Step 5: Commit** — `git add -A; git commit -m "feat(backend): scaffold nestjs with typeorm mysql connection"`

### Task 3: Scaffold frontend Vite + AntD + Router

**Files:**
- Create: `frontend/` (vite), `frontend/vite.config.ts` (proxy), `frontend/src/App.tsx`, `frontend/src/main.tsx`

- [x] **Step 1: Scaffold**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm i antd @tanstack/react-query zustand axios react-router-dom dayjs
```

- [x] **Step 2: `vite.config.ts`** thêm proxy:

```ts
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } },
});
```

- [x] **Step 3:** `main.tsx` bọc `<ConfigProvider locale={viVN}>` (import `antd/locale/vi_VN`), `QueryClientProvider`, `BrowserRouter`. `App.tsx` tạm render route `/login` (placeholder text "Đăng nhập") và `/` (placeholder "Sunny Admin").

- [x] **Step 4: Verify** — `npm run dev`, mở `http://localhost:5173` thấy placeholder; `npm run build` pass.

- [x] **Step 5: Commit** — `git commit -m "feat(frontend): scaffold vite react antd with api proxy"`

---

## Phase 1 — Auth, Users, Permissions (backend)

### Task 4: User entity + seed admin

**Files:**
- Create: `backend/src/users/user.entity.ts`, `backend/src/users/users.module.ts`, `backend/src/users/users.service.ts`, `backend/src/seed.ts`

- [x] **Step 1: Entity**

```ts
// backend/src/users/user.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ nullable: true }) position: string | null;   // Chức vụ
  @Column({ nullable: true }) team: string | null;       // Bộ phận
  @Column({ unique: true }) email: string;
  @Column({ nullable: true }) phone: string | null;
  @Column({ nullable: true, select: false }) passwordHash: string | null; // null = nhân sự chưa có tài khoản login
  @Column({ default: false }) isAdmin: boolean;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

- [x] **Step 2:** `users.service.ts` có `findByEmailWithPassword(email)` (addSelect passwordHash), `findById`, `create`, `update`, `remove`, `findAll`. `users.module.ts` exports service.

- [x] **Step 3: Seed script** `backend/src/seed.ts` — bootstrap app context, nếu chưa có user `admin@sunny.local` thì tạo: name `Quản trị viên`, `isAdmin: true`, passwordHash = `bcrypt.hashSync('admin123', 10)`. Thêm script `"seed": "ts-node src/seed.ts"` (hoặc chạy qua `npx ts-node -r tsconfig-paths/register src/seed.ts`).

- [x] **Step 4: Verify** — `npm run seed` rồi query: `mysql -h localhost -u root -p<pass> sunny_admin -e "SELECT id,email,isAdmin FROM users"` → 1 dòng admin.

- [x] **Step 5: Commit** — `git commit -m "feat(backend): user entity and admin seed"`

### Task 5: Auth module (login / refresh / logout)

**Files:**
- Create: `backend/src/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `refresh-token.entity.ts`, `dto/login.dto.ts`, `backend/src/common/guards/jwt-auth.guard.ts`, `backend/src/common/decorators/current-user.decorator.ts`
- Test: `backend/src/auth/auth.service.spec.ts`

- [x] **Step 1: Entity refresh token**

```ts
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn() id: number;
  @Column() userId: number;
  @Column() tokenHash: string;        // sha256 của refresh token
  @Column() expiresAt: Date;
  @Column({ type: 'datetime', nullable: true }) revokedAt: Date | null;
}
```

- [x] **Step 2: Failing tests** `auth.service.spec.ts` (mock repository + UsersService):
  - `login` đúng mật khẩu → trả `{ accessToken, refreshToken, user }`; user inactive → `UnauthorizedException`; sai mật khẩu → `UnauthorizedException`.
  - `refresh` với token đã revoke hoặc hết hạn → `UnauthorizedException`; token hợp lệ → access mới + **rotate** refresh (revoke cũ, tạo mới).
  - `logout` → revoke token.

Run: `npm test -- auth.service` → FAIL (chưa có service).

- [x] **Step 3: Implement `auth.service.ts`**

```ts
// Cốt lõi:
async login(email: string, password: string) {
  const user = await this.users.findByEmailWithPassword(email);
  if (!user?.passwordHash || !user.isActive) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
  return this.issueTokens(user);
}
private async issueTokens(user: User) {
  const accessToken = this.jwt.sign({ sub: user.id, email: user.email, isAdmin: user.isAdmin },
    { secret: env.JWT_ACCESS_SECRET, expiresIn: env.JWT_ACCESS_TTL });
  const refreshToken = randomBytes(48).toString('hex');
  await this.refreshRepo.save({ userId: user.id, tokenHash: sha256(refreshToken), expiresAt: addDays(new Date(), 7) });
  return { accessToken, refreshToken, user: publicUser(user) };
}
async refresh(rawToken: string) { /* tìm theo sha256, check revokedAt/expiresAt/user.isActive, revoke cũ, issueTokens lại */ }
async logout(rawToken: string) { /* set revokedAt */ }
```

- [x] **Step 4: Controller** — cookie là điểm bắt buộc theo spec:

```ts
@Post('login')
async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
  const { accessToken, refreshToken, user } = await this.auth.login(dto.email, dto.password);
  this.setRefreshCookie(res, refreshToken);
  return { accessToken, user };
}
// refresh: đọc @Req() req.cookies['refresh_token'] ; logout: revoke + clearCookie
private setRefreshCookie(res: Response, token: string) {
  res.cookie('refresh_token', token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/api/auth', maxAge: 7 * 24 * 3600 * 1000,
  });
}
```

`JwtAuthGuard`: đọc header `Authorization: Bearer`, verify bằng `JWT_ACCESS_SECRET`, gắn `req.user = payload`. `@CurrentUser()` decorator lấy `req.user`.

- [ ] **Step 5: Run tests** — `npm test -- auth.service` → PASS.

- [ ] **Step 6: Verify thủ công** — `curl -i -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@sunny.local","password":"admin123"}'` → 201, body có `accessToken`, header `Set-Cookie: refresh_token=...; HttpOnly`.

- [ ] **Step 7: Commit** — `git commit -m "feat(backend): jwt auth with httponly refresh cookie and rotation"`

### Task 6: Permissions module + PermissionGuard

**Files:**
- Create: `backend/src/permissions/permission.entity.ts`, `permissions.module.ts`, `permissions.service.ts`, `permissions.controller.ts`, `backend/src/common/screen-key.ts`, `backend/src/common/decorators/require-permission.decorator.ts`, `backend/src/common/guards/permission.guard.ts`
- Test: `backend/src/common/guards/permission.guard.spec.ts`

- [ ] **Step 1: Định nghĩa**

```ts
// backend/src/common/screen-key.ts
export enum ScreenKey {
  COMPONENTS = 'COMPONENTS', BOM = 'BOM', PERSONNEL = 'PERSONNEL',
  PURCHASING_TEAMS = 'PURCHASING_TEAMS', ONHAND = 'ONHAND', ORDERS = 'ORDERS',
  MRP = 'MRP', OUTPUT_PURCHASE = 'OUTPUT_PURCHASE', OUTPUT_PSI = 'OUTPUT_PSI',
  USERS = 'USERS', PERMISSIONS = 'PERMISSIONS',
}
export type CrudAction = 'create' | 'read' | 'update' | 'delete';
```

```ts
@Entity('permissions')
@Unique(['userId', 'screenKey'])
export class Permission {
  @PrimaryGeneratedColumn() id: number;
  @Column() userId: number;
  @Column({ type: 'enum', enum: ScreenKey }) screenKey: ScreenKey;
  @Column({ default: false }) canCreate: boolean;
  @Column({ default: false }) canRead: boolean;
  @Column({ default: false }) canUpdate: boolean;
  @Column({ default: false }) canDelete: boolean;
}
```

`@RequirePermission(ScreenKey.X, 'read')` = SetMetadata `{screen, action}`.

- [ ] **Step 2: Failing tests cho guard:** admin bypass → allow; user có quyền đúng action → allow; thiếu quyền → `ForbiddenException`; endpoint không gắn metadata → allow (chỉ cần JWT).

- [ ] **Step 3: Implement guard** — đọc metadata qua `Reflector`; nếu `req.user.isAdmin` → true; ngược lại query permission `(userId, screenKey)` và check cờ tương ứng. Đăng ký global: `APP_GUARD` thứ tự `JwtAuthGuard` (có `@Public()` decorator để mở `auth/*`, `health`) rồi `PermissionGuard`.

- [ ] **Step 4: Controller permissions** (screen PERMISSIONS):
  - `GET /api/permissions/screens` → danh sách screen keys + nhãn tiếng Việt.
  - `GET /api/permissions/:userId` → mảng permission của user (đủ 11 screen, thiếu thì trả mặc định false).
  - `PUT /api/permissions/:userId` body `[{screenKey, canCreate, canRead, canUpdate, canDelete}]` → upsert.
  - `GET /api/permissions/me` → quyền của user đang đăng nhập (FE dùng để ẩn menu; với admin trả full true).

- [ ] **Step 5: Run tests** → PASS. **Commit** — `git commit -m "feat(backend): per-user per-screen crud permissions with guard"`

### Task 7: Users controller (Quản trị người dùng + Nhân sự)

**Files:**
- Create: `backend/src/users/users.controller.ts`, `backend/src/users/dto/*.ts`
- Test: `backend/src/users/users.controller.spec.ts`

- [ ] **Step 1:** Hai nhóm route trên cùng UsersService:
  - **USERS** (Quản trị): `GET/POST/PATCH/DELETE /api/users` — đủ trường, có `password` (hash trước khi lưu), `isAdmin`, `isActive`. Không cho xóa/khóa chính mình.
  - **PERSONNEL** (Nhân sự): `GET/POST/PATCH/DELETE /api/personnel` — chỉ các trường `name, position, team, email, phone` (đúng Input #3). Không đụng password/isAdmin.
- [ ] **Step 2:** DTO + validation (`@IsEmail`, name bắt buộc). Test controller: PERSONNEL update không thể set isAdmin (DTO whitelist loại bỏ).
- [ ] **Step 3:** Run tests → PASS. **Commit** — `git commit -m "feat(backend): users admin crud and personnel endpoints"`

---

## Phase 2 — Domain modules (backend)

### Task 8: Components module (Quản lý mã)

**Files:**
- Create: `backend/src/components/component.entity.ts`, `components.module.ts`, `components.service.ts`, `components.controller.ts`, `dto/component.dto.ts`
- Test: `backend/src/components/components.service.spec.ts`

- [ ] **Step 1: Entity**

```ts
export enum Mob { KHONG = 'KHONG', CO_THE = 'CO_THE', BAT_BUOC = 'BAT_BUOC' }

@Entity('components')
export class ComponentEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) code: string;                  // Component
  @Column({ nullable: true }) classification: string | null; // Component classification
  @Column({ nullable: true }) description: string | null;  // Component description
  @Column({ default: 'PC' }) uom: string;                  // UoM
  @Column({ type: 'enum', enum: Mob, default: Mob.KHONG }) mob: Mob; // MoB
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: decimalToNumber }) moq: number;
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: decimalToNumber }) inventoryLevel: number; // Tồn định mức
  @CreateDateColumn() createdAt: Date; @UpdateDateColumn() updatedAt: Date;
}
```

(`decimalToNumber` transformer dùng chung, đặt tại `backend/src/common/decimal.transformer.ts`: `{ to: v => v, from: v => (v == null ? v : Number(v)) }`.)

- [ ] **Step 2:** CRUD routes gắn `@RequirePermission(ScreenKey.COMPONENTS, ...)`: `GET /api/components?search=&classification=` (paginate `page,pageSize`, default 20), `POST`, `PATCH /:id`, `DELETE /:id` (chặn xóa nếu đang được BoM/order tham chiếu → 409 với message tiếng Việt). `GET /api/components/classifications` → distinct list (cho dropdown).
- [ ] **Step 3:** Tests: tạo trùng `code` → `ConflictException`; xóa khi có bom_lines tham chiếu → `ConflictException`. Run → PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat(backend): components crud"`

### Task 9: Excel helper + import/template cho Components

**Files:**
- Create: `backend/src/common/excel/excel.service.ts`
- Modify: `backend/src/components/components.controller.ts`, `components.service.ts`
- Test: `backend/src/common/excel/excel.service.spec.ts`, `backend/src/components/components.import.spec.ts`

- [ ] **Step 1: ExcelService dùng chung** (exceljs):

```ts
export interface SheetSpec { columns: { header: string; key: string; required?: boolean; type?: 'string'|'number'|'enum'; enumValues?: string[] }[] }
export interface RowError { row: number; column: string; message: string }
export interface ParseResult<T> { rows: T[]; errors: RowError[] }

@Injectable()
export class ExcelService {
  buildTemplate(spec: SheetSpec): Promise<Buffer>;      // header đúng tên cột spec
  parse<T>(buffer: Buffer, spec: SheetSpec): Promise<ParseResult<T>>;
  // parse: dòng 1 phải khớp đủ header (sai → throw BadRequest 'Sai định dạng file mẫu');
  // từng dòng: thiếu required / sai số / sai enum → push RowError, dòng hợp lệ vẫn trả về trong rows.
}
```

- [ ] **Step 2: Failing tests parser:** file đúng → rows đủ; thiếu header → BadRequest; ô số chứa chữ → RowError có số dòng + tên cột; dòng trống bị bỏ qua. (Tạo buffer test bằng chính exceljs trong spec.)
- [ ] **Step 3: Implement, run tests → PASS.**
- [ ] **Step 4: Components import** — spec cột: `Component*, Component classification, Component description, UoM*, MoB (Make or Buy)*, MoQ, Inventory Levels` (* = required). Map MoB tiếng Việt: `Không → KHONG`, `Có thể → CO_THE`, `Bắt buộc → BAT_BUOC` (chấp nhận cả giá trị enum gốc).
  - `GET /api/components/template` → file xlsx (Content-Disposition attachment).
  - `POST /api/components/import?mode=preview|commit` (multipart `file`) → `{ valid: n, errors: RowError[] }`; mode commit: upsert theo `code` các dòng hợp lệ.
- [ ] **Step 5:** Test import: trùng code trong file → lấy dòng cuối; commit tạo/ cập nhật đúng. Run → PASS. **Commit** — `git commit -m "feat(backend): shared excel service and components import"`

### Task 10: BoM module

**Files:**
- Create: `backend/src/bom/bom-line.entity.ts`, `bom.module.ts`, `bom.service.ts`, `bom.controller.ts`
- Test: `backend/src/bom/bom.service.spec.ts`

- [ ] **Step 1: Entity** — lưu mã thô để hỗ trợ "mã chưa khai báo":

```ts
@Entity('bom_lines')
@Unique(['parentCode', 'childCode'])
export class BomLine {
  @PrimaryGeneratedColumn() id: number;
  @Column() parentCode: string;   // Material
  @Column() childCode: string;    // Component
  @Column({ type: 'decimal', precision: 18, scale: 6, transformer: decimalToNumber }) quantityPerUnit: number; // định mức / 1 đơn vị cha
}
```

- [ ] **Step 2: Service + routes:**
  - `GET /api/bom?parentCode=` → lines kèm cờ `parentRegistered/childRegistered` (join components theo code) — FE bôi đỏ theo cờ này.
  - `POST /api/bom`, `PATCH /api/bom/:id`, `DELETE /api/bom/:id`. POST kiểm tra **vòng lặp**: duyệt DFS từ childCode xuống, nếu gặp lại parentCode → `BadRequestException('BoM bị lặp vòng: ...')`.
  - `GET /api/bom/tree/:code` → cây đa cấp đệ quy `{code, description, registered, quantityPerUnit, children[]}` (giới hạn depth 10).
  - `GET /api/bom/unregistered` → danh sách mã xuất hiện trong BoM nhưng chưa có trong components (cho Dashboard sau này + cảnh báo màn BoM).
  - Import/template: cột `Material*, Material description, Component*, Component description, Quantity*`; import KHÔNG chặn mã chưa khai báo (chỉ cảnh báo trong response `warnings`), upsert theo (Material, Component).
- [ ] **Step 3: Tests:** cycle detection (A→B, B→A bị chặn); tree 3 cấp đúng số lượng; unregistered đúng. Run → PASS. **Commit** — `git commit -m "feat(backend): bom module with cycle check, tree, import"`

### Task 11: On-Hand inventory module

**Files:**
- Create: `backend/src/onhand/onhand.entity.ts`, `onhand.module.ts`, `onhand.service.ts`, `onhand.controller.ts`
- Test: `backend/src/onhand/onhand.service.spec.ts`

- [ ] **Step 1:** Entity `onhand_inventory`: `id, componentCode (unique), quantity decimal(18,4) default 0, updatedAt`. Quy ước spec: **mã không có bản ghi = tồn 0**.
- [ ] **Step 2:** Routes: `GET /api/onhand` (left-join components → kèm description, cờ `registered`), `PUT /api/onhand/:componentCode` body `{quantity}` (upsert), `DELETE /api/onhand/:id`. Import/template cột: `Component*, Component description, On-Hand Inventory*` — mã lạ vẫn nhận, trả `warnings`.
- [ ] **Step 3:** Tests: upsert; getQuantityMap trả 0 cho mã thiếu. Run → PASS. **Commit** — `git commit -m "feat(backend): onhand inventory module"`

### Task 12: Personnel import + Purchasing teams module

**Files:**
- Modify: `backend/src/users/users.controller.ts` (personnel import/template)
- Create: `backend/src/purchasing-teams/` (`team.entity.ts`, `team-member.entity.ts`, `team-scope.entity.ts`, module/service/controller)
- Test: `backend/src/purchasing-teams/purchasing-teams.service.spec.ts`

- [ ] **Step 1: Personnel import** — cột `Personal*, Position, Team, Mail*, Phone`; upsert theo Mail; map vào users (không tạo password).
- [ ] **Step 2: Entities teams**

```ts
@Entity('purchasing_teams') export class PurchasingTeam {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) name: string;
  @Column({ nullable: true }) description: string | null;
}
@Entity('purchasing_team_members') @Unique(['teamId','userId'])
export class PurchasingTeamMember { @PrimaryGeneratedColumn() id: number; @Column() teamId: number; @Column() userId: number; }
@Entity('purchasing_team_scopes')
export class PurchasingTeamScope {
  @PrimaryGeneratedColumn() id: number; @Column() teamId: number;
  @Column({ nullable: true }) classification: string | null;   // phụ trách theo loại hàng
  @Column({ nullable: true }) componentCode: string | null;    // hoặc mã cụ thể
} // service validate: đúng 1 trong 2 trường
```

- [ ] **Step 3: Routes** (screen PURCHASING_TEAMS):
  - `GET/POST/PATCH/DELETE /api/purchasing-teams` (GET list kèm count members/scopes).
  - `GET /api/purchasing-teams/:id` → detail: members (join users name/email/team), scopes.
  - `POST /api/purchasing-teams/:id/members {userId}`, `DELETE .../members/:memberId`.
  - `POST /api/purchasing-teams/:id/scopes {classification? , componentCode?}`, `DELETE .../scopes/:scopeId`.
  - `GET /api/purchasing-teams/unassigned-components` → components có `mob != KHONG` mà không khớp scope nào (theo classification hoặc code) — đây là cảnh báo "thành phần chưa có người mua" của spec.
- [ ] **Step 4:** Tests: scope phải có đúng 1 trường; unassigned đúng với cả 2 kiểu scope. Run → PASS. **Commit** — `git commit -m "feat(backend): personnel import and purchasing teams"`

### Task 13: Orders module + Tổng hợp

**Files:**
- Create: `backend/src/orders/order.entity.ts`, `order-line.entity.ts`, `aggregation.entity.ts`, `aggregation-line.entity.ts`, module/service/controller
- Test: `backend/src/orders/orders.service.spec.ts`

- [ ] **Step 1: Entities:** `orders(id, code unique, customerGroup, note, status ENUM('DRAFT','AGGREGATED') default DRAFT, createdById, createdAt)`; `order_lines(id, orderId FK cascade, componentCode, quantity decimal)`; `order_aggregations(id, createdById, createdAt)`; `aggregation_lines(id, aggregationId FK, componentCode, totalQty)`.
- [ ] **Step 2: Routes** (screen ORDERS): CRUD orders (POST nhận lines lồng nhau, PATCH thay toàn bộ lines); `POST /api/orders/aggregate` — gom mọi order `status=DRAFT`, group by componentCode sum quantity → tạo aggregation + set các order đó `AGGREGATED`; `GET /api/orders/aggregations` + `GET /api/orders/aggregations/latest` (kèm lines + description + cờ registered). Import/template: `Customer group*, Material*, Material description, Order quantity*` — mỗi `Customer group` trong file gom thành 1 order DRAFT (code tự sinh `PO-YYYYMMDD-xxx`).
- [ ] **Step 3:** Tests: aggregate gộp đúng mã trùng giữa nhiều đơn; đơn đã AGGREGATED không gộp lại. Run → PASS. **Commit** — `git commit -m "feat(backend): orders with aggregation and import"`

---

## Phase 3 — MRP engine & Outputs (backend)

### Task 14: Pure MRP engine (TDD — quan trọng nhất)

**Files:**
- Create: `backend/src/mrp/engine/mrp-engine.ts`
- Test: `backend/src/mrp/engine/mrp-engine.spec.ts`

> **Công thức (đã chốt ở spec):** `Demand = Order − OnHand + Levels`; demand âm → Demand=0 và |âm| là Recovery. OnHand vòng n = OnHand ban đầu + tổng Purchase các vòng trước. Levels = 0 nếu mã đã có Demand > 0 ở vòng trước. Purchase chỉ với MoB ∈ {CO_THE, BAT_BUOC}; purchase > 0 thì ≥ MoQ. Dừng khi mọi Manufacturing = 0 hoặc hết vòng 9.

- [ ] **Step 1: Khai báo types + viết failing tests trước:**

```ts
// mrp-engine.ts — chỉ types trước
export interface EngineComponent { code: string; mob: 'KHONG'|'CO_THE'|'BAT_BUOC'; moq: number; inventoryLevel: number; }
export interface BomEdge { parentCode: string; childCode: string; qtyPerUnit: number; }
export interface DemandInput { code: string; orderQty: number; }
export interface EngineLine { code: string; orderQty: number; onhand: number; levels: number; demand: number; purchase: number; manufacturing: number; recovery: number; }
```

Test cases bắt buộc (`mrp-engine.spec.ts`):

```ts
describe('computeRound', () => {
  // Số liệu mẫu sheet 2.0 Process: Order 50, OnHand 3, Levels 2 → Demand 49
  it('tính demand theo ví dụ Excel: 50 - 3 + 2 = 49', ...);
  it('demand âm → demand 0, recovery = phần dư (Order 5, OnHand 10, Levels 2 → demand 0, recovery 3)', ...);
  it('MoB BAT_BUOC → purchase = max(demand, moq), manufacturing 0', ...);
  it('MoB KHONG → purchase 0, manufacturing = demand', ...);
  it('MoB CO_THE → mặc định manufacturing = demand, purchase 0', ...);
  it('vòng sau: onhand = onhand ban đầu + purchase các vòng trước', ...);
  it('vòng sau: levels = 0 nếu mã đã có demand > 0 vòng trước', ...);
  it('mã chưa khai báo → throw với message chứa code', ...);
});
describe('applyPurchaseEdit', () => {
  it('CO_THE: purchase 10 / demand 49 → manufacturing 39 (khớp ví dụ Excel)', ...);
  it('purchase > 0 nhưng < moq → BadRequest', ...);
  it('purchase > demand (do MoQ) → manufacturing = 0, không âm', ...);
  it('MoB KHONG: purchase != 0 → reject', ...);
});
describe('explodeNextDemands', () => {
  it('manufacturing 39 × BoM con 0.029/đv → demand con 1.131, cộng dồn mã trùng từ nhiều cha', ...);
  it('manufacturing 0 → không sinh demand con', ...);
});
describe('isFinished', () => {
  it('mọi manufacturing = 0 → true; còn manufacturing > 0 và round < 9 → false; round = 9 → true', ...);
});
```

Run: `npm test -- mrp-engine` → FAIL.

- [ ] **Step 2: Implement đầy đủ:**

```ts
export function computeRound(
  demands: DemandInput[],
  components: Map<string, EngineComponent>,
  initialOnhand: Map<string, number>,
  purchasedBefore: Map<string, number>,
  demandedBefore: Set<string>,
): EngineLine[] {
  return demands.map(({ code, orderQty }) => {
    const info = components.get(code);
    if (!info) throw new Error(`Mã ${code} chưa được khai báo tại Quản lý mã`);
    const onhand = (initialOnhand.get(code) ?? 0) + (purchasedBefore.get(code) ?? 0);
    const levels = demandedBefore.has(code) ? 0 : info.inventoryLevel;
    const raw = orderQty - onhand + levels;
    const demand = Math.max(0, round4(raw));
    const recovery = Math.max(0, round4(-raw));
    const { purchase, manufacturing } = defaultSplit(demand, info);
    return { code, orderQty: round4(orderQty), onhand, levels, demand, purchase, manufacturing, recovery };
  });
}

export function defaultSplit(demand: number, c: EngineComponent) {
  if (demand <= 0) return { purchase: 0, manufacturing: 0 };
  if (c.mob === 'BAT_BUOC') return { purchase: Math.max(demand, c.moq), manufacturing: 0 };
  return { purchase: 0, manufacturing: demand };
}

export function applyPurchaseEdit(line: EngineLine, purchase: number, c: EngineComponent): EngineLine {
  if (c.mob === 'KHONG' && purchase !== 0) throw new Error('Mã khai báo là sản xuất, không được mua');
  if (c.mob === 'BAT_BUOC') throw new Error('Mã bắt buộc mua, không chỉnh tay');
  if (purchase < 0 || (purchase > 0 && purchase < c.moq))
    throw new Error(`Số lượng mua phải bằng 0 hoặc ≥ MoQ (${c.moq})`);
  return { ...line, purchase: round4(purchase), manufacturing: Math.max(0, round4(line.demand - purchase)) };
}

export function explodeNextDemands(lines: EngineLine[], edges: BomEdge[]): DemandInput[] {
  const byParent = new Map<string, BomEdge[]>();
  for (const e of edges) (byParent.get(e.parentCode) ?? byParent.set(e.parentCode, []).get(e.parentCode)!).push(e);
  const acc = new Map<string, number>();
  for (const l of lines) {
    if (l.manufacturing <= 0) continue;
    for (const e of byParent.get(l.code) ?? [])
      acc.set(e.childCode, round4((acc.get(e.childCode) ?? 0) + l.manufacturing * e.qtyPerUnit));
  }
  return [...acc].map(([code, orderQty]) => ({ code, orderQty }));
}

export const MAX_ROUNDS = 9;
export function isFinished(lines: EngineLine[], round: number): boolean {
  return round >= MAX_ROUNDS || lines.every((l) => l.manufacturing === 0);
}
const round4 = (n: number) => Math.round(n * 10000) / 10000;
```

- [ ] **Step 3: Run** `npm test -- mrp-engine` → PASS toàn bộ. **Commit** — `git commit -m "feat(backend): pure mrp engine with tdd"`

### Task 15: MRP runs module (orchestration + persistence)

**Files:**
- Create: `backend/src/mrp/mrp-run.entity.ts`, `mrp-line.entity.ts`, `mrp.module.ts`, `mrp.service.ts`, `mrp.controller.ts`
- Test: `backend/src/mrp/mrp.service.spec.ts` (sqlite in-memory hoặc mock repos)

- [ ] **Step 1: Entities:**

```ts
@Entity('mrp_runs') export class MrpRun {
  @PrimaryGeneratedColumn() id: number;
  @Column() aggregationId: number;
  @Column({ type: 'enum', enum: ['RUNNING','DONE'], default: 'RUNNING' }) status: 'RUNNING'|'DONE';
  @Column() currentRound: number;            // vòng đang mở (1-based)
  @Column() createdById: number; @CreateDateColumn() createdAt: Date;
}
@Entity('mrp_lines') export class MrpLine {
  @PrimaryGeneratedColumn() id: number;
  @Column() runId: number; @Column() round: number; @Column() componentCode: string;
  // các cột decimal(18,4) transformer số: orderQty, onhand, levels, demand, purchase, manufacturing, recovery
  @Column({...}) orderQty: number; /* ... đủ 7 cột như EngineLine */
  @Column({ default: false }) locked: boolean; // vòng đã chốt
}
```

- [ ] **Step 2: Service flows** (mỗi flow một method, dùng engine thuần):
  - `createRun(userId)`: lấy aggregation mới nhất (không có → BadRequest "Chưa có đơn hàng tổng hợp"); validate mọi mã đã khai báo (chưa → BadRequest liệt kê mã); load components + onhand map; `computeRound` vòng 1; lưu run + lines.
  - `updateLine(runId, lineId, purchase)`: chỉ cho sửa khi line thuộc `currentRound` và run RUNNING; gọi `applyPurchaseEdit`; lưu.
  - `closeRound(runId)`: lock lines vòng hiện tại; `explodeNextDemands` với BoM edges; nếu `isFinished` hoặc không còn demand → run DONE; ngược lại `computeRound` vòng tiếp (purchasedBefore = sum purchase các vòng đã lock theo mã; demandedBefore = mã có demand > 0 các vòng trước) → lưu vòng mới, `currentRound++`.
  - `getRun(id)`: run + lines group theo round, kèm description/mob/moq/uom từ components.
  - `listRuns()`: lịch sử.
- [ ] **Step 3: Tests tích hợp service** (kịch bản 2 cấp BoM: SP cha MoB KHONG, con CO_THE, cháu BAT_BUOC; chạy createRun → closeRound tới DONE; assert số từng vòng đúng tay tính). Run → PASS.
- [ ] **Step 4: Routes** (screen MRP): `POST /api/mrp/runs`, `GET /api/mrp/runs`, `GET /api/mrp/runs/:id`, `PATCH /api/mrp/runs/:id/lines/:lineId` body `{purchase}`, `POST /api/mrp/runs/:id/close-round`.
- [ ] **Step 5: Commit** — `git commit -m "feat(backend): mrp run orchestration with round close"`

### Task 16: Output endpoints (3.1 + 3.2)

**Files:**
- Create: `backend/src/outputs/outputs.module.ts`, `outputs.service.ts`, `outputs.controller.ts`
- Test: `backend/src/outputs/outputs.service.spec.ts`

- [ ] **Step 1:** 3 endpoint đọc từ `mrp_lines` của 1 run (query `?runId=`, mặc định run mới nhất DONE):
  - `GET /api/outputs/purchase-summary` (screen OUTPUT_PURCHASE) → pivot: mỗi component 1 dòng `{code, classification, description, uom, total, rounds: {1: x, 2: y, ...}}` từ cột `purchase > 0`.
  - `GET /api/outputs/recovery-summary` (screen OUTPUT_PURCHASE) → pivot tương tự từ `recovery > 0`.
  - `GET /api/outputs/psi` (screen OUTPUT_PSI) → mỗi component xuất hiện trong run: `{code, classification, description, uom, onhand (ban đầu), purchase (tổng), closing (= inventoryLevel), sale (= onhand + purchase − closing)}` — đúng công thức sheet 3.2.
- [ ] **Step 2:** Tests pivot tổng + theo vòng đúng; PSI đúng công thức. Run → PASS. **Commit** — `git commit -m "feat(backend): output summaries purchase/recovery/psi"`

---

## Phase 4 — Frontend

> Pattern chung: TanStack Query (`useQuery`/`useMutation` + invalidate), antd `Table` + `Modal` + `Form`. Mọi màn nhập liệu có nút theo quyền (`usePermission`). Code màn Quản lý mã (Task 19) là mẫu chuẩn — các màn sau dùng đúng pattern đó với cột/field liệt kê trong từng task.

### Task 17: API client + auth store + login + route guard

**Files:**
- Create: `frontend/src/api/client.ts`, `frontend/src/stores/auth.ts`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/components/RequireAuth.tsx`

- [ ] **Step 1: Auth store (Zustand, in-memory — KHÔNG persist):**

```ts
interface AuthState {
  accessToken: string | null;
  user: { id: number; name: string; email: string; isAdmin: boolean } | null;
  permissions: Record<string, { canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean }>;
  setAuth(token: string, user: User): void; clear(): void;
}
export const useAuth = create<AuthState>((set) => ({ ... })); // KHÔNG dùng persist middleware
```

- [ ] **Step 2: Axios client** `baseURL: '/api'`, `withCredentials: true`. Request interceptor gắn `Authorization` từ store. Response interceptor: 401 (trừ chính `/auth/*`) → gọi `POST /auth/refresh` (single-flight: dùng 1 promise chung tránh gọi song song) → thành công: cập nhật store + retry request; thất bại: `clear()` + chuyển `/login`.
- [ ] **Step 3: LoginPage** — form email/password (antd), submit → `/auth/login`, lưu store, fetch `/permissions/me` vào store, navigate `/`. `RequireAuth`: nếu chưa có token → thử refresh 1 lần (cover F5) → vẫn không có thì redirect `/login`.
- [ ] **Step 4: Verify:** login admin → vào `/`; F5 vẫn giữ đăng nhập (qua refresh cookie); xóa cookie → về login. `npm run build` pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): auth flow with in-memory access token and cookie refresh"`

### Task 18: App layout + menu theo quyền

**Files:**
- Create: `frontend/src/layouts/AppLayout.tsx`, `frontend/src/hooks/usePermission.ts`, `frontend/src/router.tsx`, `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1:** `usePermission(screenKey)` đọc store → `{canRead, canCreate, canUpdate, canDelete}` (admin → all true).
- [ ] **Step 2:** `AppLayout`: antd `Layout` sidebar menu nhóm:
  - **Tổng quan**: Dashboard (`/`) — `DashboardPage` là **trang trắng** chỉ có `<Empty description="Dashboard sẽ được phát triển sau" />`.
  - **Khai báo (Input)**: Quản lý mã `/components`, Quản lý BoM `/bom`, Nhân sự `/personnel`, Team mua hàng `/purchasing-teams`, Hàng thực tế `/onhand`, Đơn hàng `/orders`.
  - **Tính toán**: Chạy MRP `/mrp`.
  - **Kết quả (Output)**: Tổng hợp mua & Thu hồi phế `/outputs/purchase`, Tồn kho PSI `/outputs/psi`.
  - **Quản trị**: Người dùng `/users`, Phân quyền `/permissions`.
  - Item ẩn nếu `!canRead`. Header: tên user + nút Đăng xuất (gọi `/auth/logout` + clear store).
- [ ] **Step 3:** Router đủ các route trên (element placeholder cho màn chưa làm). Route component bọc check `canRead` → không quyền render `<Result status="403" />`.
- [ ] **Step 4:** Verify build + đăng nhập thấy menu đầy đủ (admin). **Commit** — `git commit -m "feat(frontend): app layout with permission-aware menu"`

### Task 19: Màn Quản lý mã (pattern chuẩn CRUD + import)

**Files:**
- Create: `frontend/src/pages/components/ComponentsPage.tsx`, `frontend/src/components/ImportExcelButton.tsx`, `frontend/src/api/components.ts`

- [ ] **Step 1:** Bảng cột: `Mã thành phần (code)`, `Phân loại (classification)`, `Mô tả (description)`, `Đơn vị (uom)`, `Mua hay sản xuất (mob → tag: Không/Có thể/Bắt buộc)`, `MoQ`, `Tồn định mức (inventoryLevel)`, cột Thao tác (Sửa/Xóa theo quyền). Search box theo mã/mô tả, filter phân loại. Phân trang server-side.
- [ ] **Step 2:** Modal Form thêm/sửa: code (disable khi sửa), classification (AutoComplete từ `/components/classifications`), description, uom, mob (Select 3 giá trị tiếng Việt), moq, inventoryLevel (InputNumber ≥ 0). Validate required: code, uom, mob.
- [ ] **Step 3: `ImportExcelButton` dùng chung** props `{templateUrl, importUrl, onDone}`: nút "Tải file mẫu" (window.open templateUrl với token? — dùng axios blob + saveAs để gửi được Authorization) + nút "Import Excel" (Upload antd, accept .xlsx) → gọi `?mode=preview` → Modal hiển thị `Hợp lệ: n dòng` + bảng lỗi (Dòng/Cột/Lý do) → nút "Ghi các dòng hợp lệ" gọi `?mode=commit` → message thành công + invalidate query.
- [ ] **Step 4:** Verify thủ công: thêm/sửa/xóa mã; import file mẫu tự tải về có sửa data. **Commit** — `git commit -m "feat(frontend): components screen with crud and excel import"`

### Task 20: Màn Quản lý BoM

**Files:**
- Create: `frontend/src/pages/bom/BomPage.tsx`, `frontend/src/api/bom.ts`

- [ ] **Step 1:** Layout 2 phần: trái = bảng lines (cột: `Mã cha (parentCode)`, `Mã con (childCode)`, `Định mức/1 đơn vị (quantityPerUnit)`, Thao tác). **Mã có cờ `registered=false` render màu đỏ (`<Typography.Text type="danger">`) kèm icon cảnh báo; click vào → Modal "Mã X chưa được khai báo tại Quản lý mã" + nút "Đi khai báo" navigate `/components?prefill=X"** (ComponentsPage đọc query param mở sẵn modal thêm với code điền sẵn).
- [ ] **Step 2:** Form thêm line: parentCode + childCode (Select search từ `/components`, cho phép nhập mã tự do — `mode="tags"` maxCount 1), quantityPerUnit (InputNumber > 0). Lỗi cycle từ BE hiển thị message đỏ.
- [ ] **Step 3:** Phải = tab "Cây BoM": chọn mã cha → render `Tree` antd từ `/bom/tree/:code` (label: `code — description × qty`, node đỏ nếu unregistered).
- [ ] **Step 4:** ImportExcelButton với template/import BoM. Verify thủ công cả luồng đỏ-modal-khai báo. **Commit** — `git commit -m "feat(frontend): bom screen with unregistered warning and tree"`

### Task 21: Màn Nhân sự + màn Hàng thực tế

**Files:**
- Create: `frontend/src/pages/personnel/PersonnelPage.tsx`, `frontend/src/pages/onhand/OnhandPage.tsx`

- [ ] **Step 1: Nhân sự** — pattern Task 19, cột/field: `Tên (name)*, Chức vụ (position), Bộ phận (team), Mail (email)*, Điện thoại (phone)`. API `/personnel`. Import: template/import personnel.
- [ ] **Step 2: Hàng thực tế** — bảng từ `/onhand`: `Mã thành phần`, `Mô tả`, `Tồn thực tế (quantity)` — cột quantity **editable inline** (InputNumber, blur → PUT). Mã `registered=false` đỏ + modal dẫn khai báo (tái dùng cách Task 20). Nút "Thêm dòng" (chọn mã + nhập số). Ghi chú trên đầu trang: "Mã không nhập tồn được tính bằng 0". Import onhand.
- [ ] **Step 3:** Verify + **Commit** — `git commit -m "feat(frontend): personnel and onhand screens"`

### Task 22: Màn Team mua hàng (list + detail)

**Files:**
- Create: `frontend/src/pages/purchasing/TeamsListPage.tsx`, `frontend/src/pages/purchasing/TeamDetailPage.tsx`

- [ ] **Step 1: List** `/purchasing-teams`: card/bảng các team (Tên, Mô tả, Số thành viên, Số nhóm hàng phụ trách), nút Thêm team (Modal name+description), click row → `/purchasing-teams/:id`. Trên đầu trang: `Alert` vàng nếu `/purchasing-teams/unassigned-components` khác rỗng: "Còn N mã có thể mua chưa có team phụ trách" + nút xem danh sách (Modal bảng mã).
- [ ] **Step 2: Detail** 2 khối:
  - **Thành viên**: bảng (Tên, Bộ phận, Mail) + Select thêm user (search `/personnel`) + nút xóa khỏi team.
  - **Phụ trách mua**: bảng scopes (Loại: "Nhóm hàng"/"Mã cụ thể", Giá trị) + nút thêm scope: Radio chọn kiểu → Select classification (từ `/components/classifications`) hoặc Select component code.
- [ ] **Step 3:** Verify + **Commit** — `git commit -m "feat(frontend): purchasing teams list and detail"`

### Task 23: Màn Đơn hàng

**Files:**
- Create: `frontend/src/pages/orders/OrdersPage.tsx`

- [ ] **Step 1:** Bảng orders: `Mã đơn (code)`, `Nhóm khách hàng (customerGroup)`, `Số dòng`, `Trạng thái (DRAFT → tag xanh "Chờ tổng hợp" / AGGREGATED → tag xám "Đã tổng hợp")`, `Ngày tạo`. Modal thêm/sửa (chỉ DRAFT): customerGroup, note, bảng lines con (chọn mã + InputNumber số lượng, thêm/xóa dòng).
- [ ] **Step 2:** Nút **"Tổng hợp"** (primary, confirm): gọi `/orders/aggregate` → hiển thị kết quả: Modal bảng aggregation lines (Mã, Mô tả, Tổng số lượng). Khối "Lần tổng hợp gần nhất" hiển thị `/orders/aggregations/latest`.
- [ ] **Step 3:** ImportExcelButton (template/import orders). Verify + **Commit** — `git commit -m "feat(frontend): orders screen with aggregation"`

### Task 24: Màn Chạy MRP

**Files:**
- Create: `frontend/src/pages/mrp/MrpPage.tsx`, `frontend/src/pages/mrp/MrpRunDetail.tsx`

- [ ] **Step 1: MrpPage** — nút "Tạo phiên chạy mới" (disable + tooltip nếu chưa có aggregation; BE lỗi thì message đỏ liệt kê mã chưa khai báo) + bảng lịch sử runs (ID, Ngày, Người chạy, Trạng thái RUNNING/DONE, Vòng hiện tại) → click vào detail.
- [ ] **Step 2: MrpRunDetail** — `Tabs` mỗi vòng: "Vòng 2.1", "Vòng 2.2", … Bảng cột: `Mã`, `Mô tả`, `Order quantity`, `On-Hand`, `Levels`, `Demand`, `Purchase`, `Manufacturing`, `Thu hồi (recovery)`.
  - Vòng đã lock: read-only. Vòng hiện tại: cột Purchase editable **chỉ với MoB = CO_THE** (InputNumber; mob KHONG/BAT_BUOC disable + tooltip lý do); blur → PATCH line → render lại Manufacturing từ response; lỗi MoQ hiển thị message từ BE.
  - Nút **"Chốt vòng N"** (confirm) → POST close-round → nếu run DONE hiển thị `Result` thành công + link sang Output; ngược lại tự chuyển tab vòng mới.
- [ ] **Step 3:** Verify luồng đầy đủ bằng data mẫu (nhập mã + BoM + onhand + order như ví dụ Excel: Order 50/OnHand 3/Levels 2 → kiểm tra Demand 49; sửa Purchase 10 → Manufacturing 39). **Commit** — `git commit -m "feat(frontend): mrp run screen with editable rounds"`

### Task 25: Màn Output (3.1 + 3.2)

**Files:**
- Create: `frontend/src/pages/outputs/PurchaseSummaryPage.tsx`, `frontend/src/pages/outputs/PsiPage.tsx`

- [ ] **Step 1: PurchaseSummaryPage** `/outputs/purchase`: Select chọn run (mặc định mới nhất DONE). 2 bảng: **"Mua (Purchase)"** và **"Thu hồi phế (Recovery)"** — cột: `Mã`, `Phân loại`, `Mô tả`, `Đơn vị`, `Tổng` (bold), rồi cột động `2.1`, `2.2`, … theo số vòng của run.
- [ ] **Step 2: PsiPage** `/outputs/psi`: bảng `Mã`, `Phân loại`, `Mô tả`, `Đơn vị`, `On-Hand Inventory`, `Purchase`, `Sale`, `Closing inventory`; chú thích công thức `Sale = On-Hand + Purchase − Closing` trên đầu trang.
- [ ] **Step 3:** Verify với run DONE từ Task 24. **Commit** — `git commit -m "feat(frontend): output purchase/recovery and psi screens"`

### Task 26: Màn Quản trị người dùng + Phân quyền

**Files:**
- Create: `frontend/src/pages/admin/UsersPage.tsx`, `frontend/src/pages/admin/PermissionsPage.tsx`

- [ ] **Step 1: UsersPage** — pattern Task 19 trên `/users`: cột `Tên, Email, Chức vụ, Bộ phận, Admin (tag), Hoạt động (switch theo quyền update)`. Modal: thêm field `Mật khẩu` (Input.Password — bắt buộc khi tạo, để trống khi sửa = giữ nguyên), `isAdmin` (Switch), `isActive`.
- [ ] **Step 2: PermissionsPage** — Select user (search) → bảng ma trận: mỗi dòng 1 màn hình (11 dòng, nhãn tiếng Việt), 4 cột Checkbox `Xem (R) / Thêm (C) / Sửa (U) / Xóa (D)` + dòng "Chọn tất cả". Nút Lưu → PUT `/permissions/:userId`. Nếu user isAdmin → Alert "Admin có toàn quyền" + disable ma trận.
- [ ] **Step 3:** Verify: tạo user thường, cấp quyền chỉ COMPONENTS read → login bằng user đó: menu chỉ còn Quản lý mã + Dashboard, không có nút Thêm/Sửa/Xóa; gọi API khác bị 403. **Commit** — `git commit -m "feat(frontend): users admin and permission matrix screens"`

---

## Phase 5 — Hoàn thiện

### Task 27: E2E smoke + đối chiếu số liệu Excel + README

**Files:**
- Modify: `README.md`
- Create: `backend/test/mrp-e2e.spec.ts` (tùy chọn nếu setup e2e nhanh; tối thiểu là kịch bản thủ công ghi trong README)

- [ ] **Step 1:** Chạy full stack từ đầu: MySQL local đang chạy → seed → BE → FE. Login admin.
- [ ] **Step 2: Kịch bản đối chiếu Excel** (làm bằng UI hoặc qua import):
  1. Import components (tạo file từ template với vài mã sheet KB1: `2003031013` MoB Không, `4002010037` MoB Bắt buộc MoQ 5, …).
  2. Import BoM 2-3 cấp theo sheet KB1 (ví dụ `2003031013 → 2004010385 (1) → 2004010384 (1) → 4002010037 (0.029)`).
  3. Nhập onhand + order (Order 50 cho `2003031013`, OnHand 3, Levels 2).
  4. Chạy MRP: vòng 1 Demand phải = **49**; chỉnh Purchase ở mã CO_THE thấy Manufacturing đổi đúng; chốt các vòng tới DONE.
  5. Mở Output: tổng mua khớp tay tính; PSI đúng công thức.
- [ ] **Step 3:** Sửa mọi lệch số nếu có (debug bằng systematic-debugging skill). Cập nhật README: hướng dẫn cài đặt, cấu trúc thư mục, mô tả màn hình.
- [ ] **Step 4:** `cd backend; npm test` toàn bộ PASS; `cd frontend; npm run build` PASS.
- [ ] **Step 5: Commit** — `git commit -m "docs: setup guide and excel-verified mrp scenario"`

---

## Self-review đã thực hiện

- **Spec coverage:** Auth (T5), phân quyền per-user CRUD + màn ma trận (T6, T26), 6 màn Input (T19–T23), engine + màn MRP (T14–T15, T24), Output 3.1/3.2 (T16, T25), Dashboard trắng (T18), import Excel mọi màn Input (T9–T13), cảnh báo mã chưa khai báo + modal dẫn khai báo (T10, T20, T21), cảnh báo chưa có team phụ trách (T12, T22). Ngoài phạm vi v1 (3.3, mail, role template) — không có task, đúng spec.
- **Type consistency:** `EngineLine`/`MrpLine` 7 cột số trùng tên; screen keys thống nhất giữa T6/T18; mob enum `KHONG|CO_THE|BAT_BUOC` dùng xuyên suốt; mã nghiệp vụ dùng `componentCode`/`code` (string) ở BoM/onhand/orders/mrp — components.id chỉ dùng nội bộ CRUD.
- **Placeholder scan:** các task UI tham chiếu "pattern Task 19" đều kèm danh sách cột/field/route cụ thể của màn đó.
