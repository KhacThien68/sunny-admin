export enum ScreenKey {
  COMPONENTS = 'COMPONENTS',
  BOM = 'BOM',
  PERSONNEL = 'PERSONNEL',
  PURCHASING_TEAMS = 'PURCHASING_TEAMS',
  ONHAND = 'ONHAND',
  ORDERS = 'ORDERS',
  MRP = 'MRP',
  OUTPUT_PURCHASE = 'OUTPUT_PURCHASE',
  OUTPUT_PSI = 'OUTPUT_PSI',
  USERS = 'USERS',
  PERMISSIONS = 'PERMISSIONS',
}

export type CrudAction = 'create' | 'read' | 'update' | 'delete';

export const SCREEN_LABELS: Record<ScreenKey, string> = {
  COMPONENTS: 'Quản lý mã',
  BOM: 'Quản lý BoM',
  PERSONNEL: 'Nhân sự',
  PURCHASING_TEAMS: 'Team mua hàng',
  ONHAND: 'Hàng thực tế',
  ORDERS: 'Đơn hàng',
  MRP: 'Chạy MRP',
  OUTPUT_PURCHASE: 'Tổng hợp mua & Thu hồi phế',
  OUTPUT_PSI: 'Tồn kho PSI',
  USERS: 'Quản trị người dùng',
  PERMISSIONS: 'Phân quyền',
};
