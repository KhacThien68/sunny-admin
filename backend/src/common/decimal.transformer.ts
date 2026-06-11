import { ValueTransformer } from 'typeorm';

export const decimalToNumber: ValueTransformer = {
  to: (v?: number | null) => v,
  from: (v?: string | null) => (v == null ? v : Number(v)),
};
