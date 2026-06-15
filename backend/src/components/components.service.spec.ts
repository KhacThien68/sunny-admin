import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ExcelService } from '../common/excel/excel.service';
import { ComponentEntity, Mob } from './component.entity';
import { ComponentsService } from './components.service';
import { CreateComponentDto } from './dto/component.dto';

const makeComponent = (
  overrides: Partial<ComponentEntity> = {},
): ComponentEntity => ({
  id: 1,
  code: 'COMP-001',
  classification: 'TypeA',
  description: 'Test component',
  uom: 'PC',
  mob: Mob.KHONG,
  moq: 0,
  inventoryLevel: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ComponentsService', () => {
  let service: ComponentsService;

  const mockQb: any = {
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
  };

  const mockRepo: any = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockDataSource: any = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComponentsService,
        {
          provide: getRepositoryToken(ComponentEntity),
          useValue: mockRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        ExcelService,
      ],
    }).compile();

    service = module.get<ComponentsService>(ComponentsService);

    // Reset mocks
    jest.clearAllMocks();
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.orderBy.mockReturnThis();
    mockQb.andWhere.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.select.mockReturnThis();
    mockQb.where.mockReturnThis();
    mockQb.getManyAndCount.mockResolvedValue([[], 0]);
    mockQb.getRawMany.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException when code already exists', async () => {
      const dto: CreateComponentDto = {
        code: 'COMP-001',
        uom: 'PC',
        mob: Mob.KHONG,
      };
      mockRepo.findOne.mockResolvedValue(makeComponent());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow(
        'Mã thành phần đã tồn tại',
      );
    });

    it('should create and save a new component when code is unique', async () => {
      const dto: CreateComponentDto = {
        code: 'NEW-001',
        uom: 'PC',
        mob: Mob.KHONG,
      };
      const savedEntity = makeComponent({ code: 'NEW-001', id: 2 });
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(savedEntity);
      mockRepo.save.mockResolvedValue(savedEntity);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(savedEntity);
      expect(result).toEqual(savedEntity);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when component not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { uom: 'KG' })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update(999, { uom: 'KG' })).rejects.toThrow(
        'Không tìm thấy mã thành phần',
      );
    });

    it('should update and return the component when found', async () => {
      const existing = makeComponent();
      const updated = { ...existing, uom: 'KG' };
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(1, { uom: 'KG' });

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.uom).toBe('KG');
    });
  });

  describe('findAll', () => {
    it('should return paginated result with default page and pageSize', async () => {
      const components = [
        makeComponent(),
        makeComponent({ id: 2, code: 'COMP-002' }),
      ];
      mockQb.getManyAndCount.mockResolvedValue([components, 2]);

      const result = await service.findAll({});

      expect(result.items).toEqual(components);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should apply search filter when search param is provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'test', page: 2, pageSize: 10 });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(c.code LIKE :search OR c.description LIKE :search)',
        { search: '%test%' },
      );
      expect(mockQb.skip).toHaveBeenCalledWith(10); // (2-1)*10
      expect(mockQb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when component not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when component is referenced in bom_lines', async () => {
      mockRepo.findOne.mockResolvedValue(makeComponent());
      mockDataSource.query.mockResolvedValue([{ 1: 1 }]); // has rows

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
      await expect(service.remove(1)).rejects.toThrow(
        'Mã đang được sử dụng trong BoM, không thể xóa',
      );
    });

    it('should delete successfully when not referenced and bom_lines query succeeds with empty result', async () => {
      mockRepo.findOne.mockResolvedValue(makeComponent());
      mockDataSource.query.mockResolvedValue([]); // no rows
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(mockRepo.delete).toHaveBeenCalledWith(1);
    });

    it('should delete successfully when bom_lines table does not exist (skip check)', async () => {
      mockRepo.findOne.mockResolvedValue(makeComponent());
      mockDataSource.query.mockRejectedValue(
        new Error("Table 'bom_lines' doesn't exist"),
      );
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(mockRepo.delete).toHaveBeenCalledWith(1);
    });
  });
});
