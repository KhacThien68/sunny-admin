import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockUser: Partial<User> = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    isAdmin: false,
    isActive: true,
    passwordHash: 'hashed_password',
  };

  // Use a plain object for the query builder to avoid TypeScript strictness issues
  const mockQueryBuilder: any = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(mockUser),
  };

  const mockRepo: any = {
    find: jest.fn().mockResolvedValue([mockUser]),
    findOne: jest.fn().mockResolvedValue(mockUser),
    create: jest.fn().mockReturnValue(mockUser),
    save: jest.fn().mockResolvedValue(mockUser),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();

    // Re-attach mocks after clearAllMocks
    mockRepo.find.mockResolvedValue([mockUser]);
    mockRepo.findOne.mockResolvedValue(mockUser);
    mockRepo.create.mockReturnValue(mockUser);
    mockRepo.save.mockResolvedValue(mockUser);
    mockRepo.update.mockResolvedValue({ affected: 1 });
    mockRepo.delete.mockResolvedValue({ affected: 1 });
    mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.addSelect.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.getOne.mockResolvedValue(mockUser);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a user entity', async () => {
      const data: Partial<User> = {
        name: 'New User',
        email: 'new@example.com',
      };

      const result = await service.create(data);

      expect(mockRepo.create).toHaveBeenCalledWith(data);
      expect(mockRepo.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByEmailWithPassword', () => {
    it('should call createQueryBuilder and addSelect for passwordHash', async () => {
      const email = 'test@example.com';

      const result = await service.findByEmailWithPassword(email);

      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('user.passwordHash');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'user.email = :email',
        { email },
      );
      expect(mockQueryBuilder.getOne).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
      expect(result?.passwordHash).toBe('hashed_password');
    });
  });

  describe('update', () => {
    it('should strip passwordHash before calling repository.update', async () => {
      const data: Partial<User> = {
        name: 'Updated',
        passwordHash: 'should-be-stripped',
      };

      await service.update(1, data);

      const updateCall = mockRepo.update.mock.calls[0];
      expect(updateCall[0]).toBe(1);
      expect(updateCall[1]).not.toHaveProperty('passwordHash');
      expect(updateCall[1]).toEqual({ name: 'Updated' });
    });

    it('should throw NotFoundException when update affects no rows', async () => {
      mockRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.update(999, { name: 'Ghost' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when delete affects no rows', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('setPassword', () => {
    it('should update only the passwordHash column', async () => {
      await service.setPassword(1, 'new-hashed-password');

      expect(mockRepo.update).toHaveBeenCalledWith(1, {
        passwordHash: 'new-hashed-password',
      });
    });

    it('should throw NotFoundException when setPassword affects no rows', async () => {
      mockRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.setPassword(999, 'hash')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
