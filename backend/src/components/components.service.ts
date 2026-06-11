import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ComponentEntity } from './component.entity';
import { CreateComponentDto } from './dto/component.dto';
import { UpdateComponentDto } from './dto/component.dto';

export interface FindAllQuery {
  search?: string;
  classification?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ComponentsService {
  constructor(
    @InjectRepository(ComponentEntity)
    private readonly componentRepo: Repository<ComponentEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: FindAllQuery = {},
  ): Promise<PaginatedResult<ComponentEntity>> {
    const { search, classification, page = 1, pageSize = 20 } = query;

    const qb = this.componentRepo
      .createQueryBuilder('c')
      .orderBy('c.code', 'ASC');

    if (search) {
      qb.andWhere('(c.code LIKE :search OR c.description LIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (classification) {
      qb.andWhere('c.classification = :classification', { classification });
    }

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  findByCode(code: string): Promise<ComponentEntity | null> {
    return this.componentRepo.findOne({ where: { code } });
  }

  findById(id: number): Promise<ComponentEntity | null> {
    return this.componentRepo.findOne({ where: { id } });
  }

  async create(dto: CreateComponentDto): Promise<ComponentEntity> {
    const existing = await this.findByCode(dto.code);
    if (existing) {
      throw new ConflictException('Mã thành phần đã tồn tại');
    }
    const entity = this.componentRepo.create(dto);
    return this.componentRepo.save(entity);
  }

  async update(id: number, dto: UpdateComponentDto): Promise<ComponentEntity> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy mã thành phần');
    }
    Object.assign(existing, dto);
    return this.componentRepo.save(existing);
  }

  async remove(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy mã thành phần');
    }

    // Check references in bom_lines — table may not exist yet (Task 10)
    try {
      const rows: unknown[] = await this.dataSource.query(
        `SELECT 1 FROM bom_lines WHERE parentCode = ? OR childCode = ? LIMIT 1`,
        [existing.code, existing.code],
      );
      if (rows.length > 0) {
        throw new ConflictException(
          'Mã đang được sử dụng trong BoM, không thể xóa',
        );
      }
    } catch (err) {
      // Re-throw ConflictException
      if (err instanceof ConflictException) throw err;
      // Table doesn't exist yet — ignore the error and proceed with delete
    }

    await this.componentRepo.delete(id);
  }

  async getClassifications(): Promise<string[]> {
    const rows = await this.componentRepo
      .createQueryBuilder('c')
      .select('DISTINCT c.classification', 'classification')
      .where('c.classification IS NOT NULL')
      .orderBy('c.classification', 'ASC')
      .getRawMany<{ classification: string }>();

    return rows.map((r) => r.classification);
  }

  async getCodeMap(codes: string[]): Promise<Map<string, ComponentEntity>> {
    if (codes.length === 0) return new Map();
    const items = await this.componentRepo.find({
      where: { code: In(codes) },
    });
    return new Map(items.map((item) => [item.code, item]));
  }
}
