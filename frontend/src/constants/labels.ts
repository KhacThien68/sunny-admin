import type { MobType } from '../types/component'

export const MOB_LABELS: Record<MobType, string> = {
  KHONG: 'Sản xuất',
  CO_THE: 'Có thể mua',
  BAT_BUOC: 'Bắt buộc mua',
}

export const MOB_COLORS: Record<MobType, string | undefined> = {
  KHONG: undefined,
  CO_THE: 'blue',
  BAT_BUOC: 'red',
}
